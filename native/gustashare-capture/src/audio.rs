// Captura de audio ISOLADO de um processo (nao o mix do sistema inteiro)
// via WASAPI "process loopback" — API do Windows 10 2004+ usada por
// Discord/OBS/Teams pra "compartilhar aba com audio". Nao existe crate
// pronta pra essa parte especifica (ao contrario do video), entao isso
// foi escrito hand-rolled em cima da `windows` crate.
//
// ATENCAO — essa e a parte de MAIOR risco de todo o modulo nativo. GUIDs,
// nomes exatos de struct/feature e o tipo exato de HWND/handle mudam
// entre versoes da crate `windows` e sao dificeis de acertar de memoria,
// sem compilador/docs.rs em mãos. Se o build falhar aqui, é o esperado —
// os erros do compilador (campo/metodo não existe) indicam exatamente o
// que ajustar contra https://microsoft.github.io/windows-docs-rs/doc/windows/
// pra versão instalada.
//
// Referência canônica da Microsoft pra essa API (em C++):
// https://github.com/microsoft/Windows-Classic-Samples -> ApplicationLoopback

use napi::bindgen_prelude::Buffer;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};

use windows::core::{implement, Interface, PROPVARIANT};
use windows::Win32::Foundation::{HANDLE, WAIT_OBJECT_0};
use windows::Win32::Media::Audio::{
    ActivateAudioInterfaceAsync, IActivateAudioInterfaceAsyncOperation,
    IActivateAudioInterfaceCompletionHandler, IActivateAudioInterfaceCompletionHandler_Impl,
    IAudioCaptureClient, IAudioClient, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
    AUDCLNT_STREAMFLAGS_LOOPBACK, AUDIOCLIENT_ACTIVATION_PARAMS, AUDIOCLIENT_ACTIVATION_PARAMS_0,
    AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK, AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS,
    PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE, VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
    WAVEFORMATEX,
};
use windows::Win32::System::Com::CoInitializeEx;
use windows::Win32::System::Threading::{CreateEventW, SetEvent, WaitForSingleObject};
use windows::Win32::System::Variant::VT_BLOB;

const SAMPLE_RATE: u32 = 48000;
const CHANNELS: u16 = 2;
// mmreg.h: WAVE_FORMAT_IEEE_FLOAT = 3. Usamos o valor literal em vez de
// importar a constante — o caminho dela na crate `windows` muda bastante
// entre versões.
const WAVE_FORMAT_IEEE_FLOAT: u16 = 3;

#[implement(IActivateAudioInterfaceCompletionHandler)]
struct CompletionHandler {
    ready: HANDLE,
}

// A crate `windows` gera um tipo wrapper `CompletionHandler_Impl` (nome
// baseado no NOSSO struct, não no da interface) — é nele que a trait é
// implementada, não no struct original.
impl IActivateAudioInterfaceCompletionHandler_Impl for CompletionHandler_Impl {
    fn ActivateCompleted(
        &self,
        _activate_operation: Option<&IActivateAudioInterfaceAsyncOperation>,
    ) -> windows::core::Result<()> {
        unsafe {
            let _ = SetEvent(self.ready);
        }
        Ok(())
    }
}

type AudioCallback = ThreadsafeFunction<Buffer, ErrorStrategy::CalleeHandled>;

pub fn run_capture(
    pid: u32,
    stop_flag: std::sync::Arc<std::sync::atomic::AtomicBool>,
    callback: AudioCallback,
) -> std::result::Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use std::sync::atomic::Ordering;

    unsafe {
        CoInitializeEx(None, windows::Win32::System::Com::COINIT_MULTITHREADED).ok()?;

        let mut params = AUDIOCLIENT_ACTIVATION_PARAMS {
            ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
            Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 {
                ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                    TargetProcessId: pid,
                    ProcessLoopbackMode: PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE,
                },
            },
        };

        // Em windows 0.58, PROPVARIANT e um wrapper em `windows::core` (nao
        // mora mais em Win32::System::Com). O layout cru fica em
        // `windows::core::imp` e o blob aponta pra `params` na stack —
        // por isso ManuallyDrop: o Drop do wrapper chamaria
        // PropVariantClear e tentaria CoTaskMemFree de memoria de stack.
        let raw_prop = windows::core::imp::PROPVARIANT {
            Anonymous: windows::core::imp::PROPVARIANT_0 {
                Anonymous: windows::core::imp::PROPVARIANT_0_0 {
                    vt: VT_BLOB.0,
                    wReserved1: 0,
                    wReserved2: 0,
                    wReserved3: 0,
                    Anonymous: windows::core::imp::PROPVARIANT_0_0_0 {
                        blob: windows::core::imp::BLOB {
                            cbSize: std::mem::size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32,
                            pBlobData: &mut params as *mut _ as *mut u8,
                        },
                    },
                },
            },
        };
        let activation_prop = std::mem::ManuallyDrop::new(PROPVARIANT::from_raw(raw_prop));

        let ready_event = CreateEventW(None, true, false, None)?;
        let handler: IActivateAudioInterfaceCompletionHandler =
            CompletionHandler { ready: ready_event }.into();

        let operation = ActivateAudioInterfaceAsync(
            VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
            &IAudioClient::IID,
            Some(&*activation_prop as *const _),
            &handler,
        )?;

        WaitForSingleObject(ready_event, u32::MAX);

        let mut activate_result = windows::core::HRESULT(0);
        let mut audio_client_unknown: Option<windows::core::IUnknown> = None;
        operation.GetActivateResult(&mut activate_result, &mut audio_client_unknown)?;
        activate_result.ok()?;
        let audio_client: IAudioClient = audio_client_unknown.unwrap().cast()?;

        let wave_format = WAVEFORMATEX {
            wFormatTag: WAVE_FORMAT_IEEE_FLOAT,
            nChannels: CHANNELS,
            nSamplesPerSec: SAMPLE_RATE,
            wBitsPerSample: 32,
            nBlockAlign: (CHANNELS * 4),
            nAvgBytesPerSec: SAMPLE_RATE * CHANNELS as u32 * 4,
            cbSize: 0,
        };

        audio_client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
            10_000_000, // 1s de buffer, em unidades de 100ns
            0,
            &wave_format,
            None,
        )?;

        let data_event = CreateEventW(None, false, false, None)?;
        audio_client.SetEventHandle(data_event)?;

        let capture_client: IAudioCaptureClient = audio_client.GetService()?;
        audio_client.Start()?;

        while !stop_flag.load(Ordering::SeqCst) {
            let wait = WaitForSingleObject(data_event, 200);
            if wait != WAIT_OBJECT_0 {
                continue;
            }

            loop {
                let packet_size = capture_client.GetNextPacketSize()?;
                if packet_size == 0 {
                    break;
                }

                let mut buffer_ptr: *mut u8 = std::ptr::null_mut();
                let mut frames_available: u32 = 0;
                let mut flags: u32 = 0;

                capture_client.GetBuffer(
                    &mut buffer_ptr,
                    &mut frames_available,
                    &mut flags,
                    None,
                    None,
                )?;

                let byte_len = frames_available as usize * CHANNELS as usize * 4;
                let slice = std::slice::from_raw_parts(buffer_ptr, byte_len);
                callback.call(
                    Ok(slice.to_vec().into()),
                    ThreadsafeFunctionCallMode::NonBlocking,
                );

                capture_client.ReleaseBuffer(frames_available)?;
            }
        }

        audio_client.Stop()?;
    }

    Ok(())
}
