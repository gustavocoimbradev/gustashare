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
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use windows::core::{implement, Interface, PCWSTR};
use windows::Win32::Foundation::{HANDLE, WAIT_OBJECT_0};
use windows::Win32::Media::Audio::{
    IAudioCaptureClient, IAudioClient, AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
    AUDCLNT_STREAMFLAGS_LOOPBACK, AUDIOCLIENT_ACTIVATION_PARAMS,
    AUDIOCLIENT_ACTIVATION_PARAMS_0, AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
    AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS, AUDCLNT_SHAREMODE_SHARED, WAVEFORMATEX,
    WAVE_FORMAT_IEEE_FLOAT, PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE,
    ActivateAudioInterfaceAsync, IActivateAudioInterfaceAsyncOperation,
    IActivateAudioInterfaceCompletionHandler, IActivateAudioInterfaceCompletionHandler_Impl,
};
use windows::Win32::System::Com::{
    CoCreateFreeThreadedMarshaler, CoInitializeEx, COINIT_MULTITHREADED, STGM_READ,
};
use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
use windows::Win32::System::Threading::{CreateEventW, WaitForSingleObject};

const VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK: &str = "VAD\\Process_Loopback";
const SAMPLE_RATE: u32 = 48000;
const CHANNELS: u16 = 2;

#[implement(IActivateAudioInterfaceCompletionHandler)]
struct CompletionHandler {
    ready: HANDLE,
}

impl IActivateAudioInterfaceCompletionHandler_Impl for CompletionHandler {
    fn ActivateCompleted(
        &self,
        _activate_operation: Option<&IActivateAudioInterfaceAsyncOperation>,
    ) -> windows::core::Result<()> {
        unsafe {
            let _ = windows::Win32::System::Threading::SetEvent(self.ready);
        }
        Ok(())
    }
}

type AudioCallback = ThreadsafeFunction<Buffer, napi::ErrorStrategy::CalleeHandled>;

pub fn run_capture(
    pid: u32,
    stop_flag: Arc<AtomicBool>,
    callback: AudioCallback,
) -> std::result::Result<(), Box<dyn std::error::Error + Send + Sync>> {
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED).ok()?;

        let mut params = AUDIOCLIENT_ACTIVATION_PARAMS {
            ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
            Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 {
                ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                    TargetProcessId: pid,
                    ProcessLoopbackMode: PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE,
                },
            },
        };

        let mut prop = PROPVARIANT::default();
        // vt=VT_BLOB apontando pra AUDIOCLIENT_ACTIVATION_PARAMS — monta
        // manualmente pois a crate `windows` nao tem um helper direto
        // pra esse caso especifico.
        set_propvariant_blob(&mut prop, &mut params);

        let ready_event = CreateEventW(None, true, false, None)?;
        let handler: IActivateAudioInterfaceCompletionHandler =
            CompletionHandler { ready: ready_event }.into();

        let device_id: Vec<u16> = VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();

        let operation = ActivateAudioInterfaceAsync(
            PCWSTR(device_id.as_ptr()),
            &IAudioClient::IID,
            Some(&prop as *const _),
            &handler,
        )?;

        WaitForSingleObject(ready_event, u32::MAX);

        let mut activate_result = windows::core::HRESULT(0);
        let mut audio_client_unknown: Option<windows::core::IUnknown> = None;
        operation.GetActivateResult(&mut activate_result, &mut audio_client_unknown)?;
        activate_result.ok()?;
        let audio_client: IAudioClient = audio_client_unknown.unwrap().cast()?;

        let wave_format = WAVEFORMATEX {
            wFormatTag: WAVE_FORMAT_IEEE_FLOAT as u16,
            nChannels: CHANNELS,
            nSamplesPerSec: SAMPLE_RATE,
            wBitsPerSample: 32,
            nBlockAlign: (CHANNELS * 4) as u16,
            nAvgBytesPerSec: SAMPLE_RATE * CHANNELS as u32 * 4,
            cbSize: 0,
        };

        audio_client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK.0 as u32 | AUDCLNT_STREAMFLAGS_EVENTCALLBACK.0 as u32,
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

unsafe fn set_propvariant_blob(prop: &mut PROPVARIANT, params: &mut AUDIOCLIENT_ACTIVATION_PARAMS) {
    // VT_BLOB = 65. A PROPVARIANT da crate `windows` expõe os campos via
    // union `Anonymous`; isso replica o que o exemplo oficial da
    // Microsoft (C++) faz manualmente.
    use windows::Win32::System::Com::StructuredStorage::PROPVARIANT_0_0_0;
    prop.Anonymous.Anonymous.vt = 65u16; // VT_BLOB
    let blob = &mut prop.Anonymous.Anonymous.Anonymous;
    let _ = STGM_READ; // mantém import usado caso a versão precise dele
    blob.blob.cbSize = std::mem::size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32;
    blob.blob.pBlobData = params as *mut _ as *mut u8;
    let _: &PROPVARIANT_0_0_0 = &prop.Anonymous.Anonymous;
    let _ = CoCreateFreeThreadedMarshaler; // idem
}
