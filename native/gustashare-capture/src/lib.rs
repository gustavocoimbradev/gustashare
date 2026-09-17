// Modulo nativo (Windows) pra contornar duas limitacoes do Chromium/Electron:
//
// 1. Captura de VIDEO de uma janela especifica que usa aceleracao de GPU
//    fica preta via `desktopCapturer` (bug antigo, conhecido, do Chromium).
//    Usamos a Windows.Graphics.Capture API direto (via crate `windows-capture`,
//    ja testada pela comunidade) que nao tem esse problema.
//
// 2. Captura de AUDIO isolado de um processo especifico (nao o mix do
//    sistema inteiro) nao existe em nenhuma API que o Chromium expoe pra
//    JS. Usamos WASAPI "process loopback" (AUDIOCLIENT_ACTIVATION_TYPE_
//    PROCESS_LOOPBACK) direto via COM — API pouco documentada, essa parte
//    e a que mais provavelmente vai precisar de ajuste depois de testar
//    num Windows de verdade.
//
// Os frames de video (BGRA8 cru) e os chunks de audio (PCM f32 cru) sao
// entregues pro JS via callback; do lado do JS eles viram um MediaStream
// through canvas.captureStream() (video) e AudioContext.createMediaStream
// Destination() (audio) — ver src/lib/nativeCapture.js.

#![allow(non_snake_case)]

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

mod audio;
mod video;

#[napi]
pub struct VideoCapture {
    stop_flag: Arc<AtomicBool>,
}

#[napi]
impl VideoCapture {
    /// `hwnd`: handle da janela, como numero decimal — extraido do id que o
    /// Electron/Chromium ja da em `desktopCapturer.getSources()` (formato
    /// "window:<hwnd>:0" no Windows).
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            stop_flag: Arc::new(AtomicBool::new(false)),
        }
    }

    #[napi]
    pub fn start(
        &mut self,
        hwnd: i64,
        callback: ThreadsafeFunction<Buffer, ErrorStrategy::CalleeHandled>,
    ) -> Result<()> {
        let stop_flag = self.stop_flag.clone();
        stop_flag.store(false, Ordering::SeqCst);

        std::thread::spawn(move || {
            if let Err(err) = video::run_capture(hwnd, stop_flag, callback.clone()) {
                let _ = callback.call(
                    Err(Error::from_reason(format!("captura de video falhou: {err}"))),
                    ThreadsafeFunctionCallMode::NonBlocking,
                );
            }
        });

        Ok(())
    }

    #[napi]
    pub fn stop(&mut self) {
        self.stop_flag.store(true, Ordering::SeqCst);
    }
}

#[napi]
pub struct AudioCapture {
    stop_flag: Arc<AtomicBool>,
}

#[napi]
impl AudioCapture {
    /// `pid`: id do processo dono da janela (pega via win32 antes de
    /// chamar, ou resolvido no lado nativo a partir do hwnd — ver
    /// `resolve_pid_from_hwnd`).
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            stop_flag: Arc::new(AtomicBool::new(false)),
        }
    }

    #[napi]
    pub fn start(
        &mut self,
        pid: u32,
        callback: ThreadsafeFunction<Buffer, ErrorStrategy::CalleeHandled>,
    ) -> Result<()> {
        let stop_flag = self.stop_flag.clone();
        stop_flag.store(false, Ordering::SeqCst);

        std::thread::spawn(move || {
            if let Err(err) = audio::run_capture(pid, stop_flag, callback.clone()) {
                let _ = callback.call(
                    Err(Error::from_reason(format!("captura de audio falhou: {err}"))),
                    ThreadsafeFunctionCallMode::NonBlocking,
                );
            }
        });

        Ok(())
    }

    #[napi]
    pub fn stop(&mut self) {
        self.stop_flag.store(true, Ordering::SeqCst);
    }
}

/// Dado um HWND (decimal, do id do desktopCapturer), descobre o PID dono
/// da janela — usado pra alimentar o AudioCapture com o processo certo.
#[napi]
pub fn resolve_pid_from_hwnd(hwnd: i64) -> Result<u32> {
    video::pid_from_hwnd(hwnd).map_err(|e| Error::from_reason(e.to_string()))
}
