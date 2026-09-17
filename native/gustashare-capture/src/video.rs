// Captura de video de uma janela via Windows.Graphics.Capture, usando a
// crate `windows-capture` (ja lida com o pool de frames D3D11 e o
// threading exigido pela WinRT por baixo dos panos).
//
// ATENCAO: a API exata da `windows-capture` muda entre versoes maiores.
// Se o build falhar aqui, o erro do compilador aponta exatamente qual
// metodo/assinatura mudou — checar https://docs.rs/windows-capture pra
// versao instalada (`cargo tree -p windows-capture`) e ajustar.

use napi::bindgen_prelude::Buffer;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Error, Result};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;

use windows_capture::{
    capture::{Context, GraphicsCaptureApiHandler},
    frame::Frame,
    graphics_capture_api::InternalCaptureControl,
    settings::{
        ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
        MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
    },
    window::Window,
};

type FrameCallback = ThreadsafeFunction<Buffer, ErrorStrategy::CalleeHandled>;

const MAX_WIDTH: u32 = 1920;

fn pack_rgba_frame(raw: &[u8], width: u32, height: u32) -> Vec<u8> {
    if width == 0 || height == 0 || raw.len() < 4 {
        let mut out = vec![0u8; 8];
        out[0..4].copy_from_slice(&0u32.to_le_bytes());
        out[4..8].copy_from_slice(&0u32.to_le_bytes());
        return out;
    }

    let stride = (raw.len() / height as usize).max(width as usize * 4);
    let scale = if width > MAX_WIDTH {
        MAX_WIDTH as f32 / width as f32
    } else {
        1.0
    };
    let nw = ((width as f32 * scale) as u32).max(2) & !1;
    let nh = ((height as f32 * scale) as u32).max(2) & !1;
    let mut out = vec![0u8; 8 + (nw as usize * nh as usize * 4)];
    out[0..4].copy_from_slice(&nw.to_le_bytes());
    out[4..8].copy_from_slice(&nh.to_le_bytes());
    let dst = &mut out[8..];

    if nw == width && nh == height && stride == width as usize * 4 {
        for (i, px) in raw.chunks_exact(4).enumerate() {
            let o = i * 4;
            dst[o] = px[2];
            dst[o + 1] = px[1];
            dst[o + 2] = px[0];
            dst[o + 3] = px[3];
        }
        return out;
    }

    for y in 0..nh {
        let sy = ((y as f32 / scale) as u32).min(height - 1);
        for x in 0..nw {
            let sx = ((x as f32 * width as f32 / nw as f32) as u32).min(width - 1);
            let si = sy as usize * stride + sx as usize * 4;
            let di = (y as usize * nw as usize + x as usize) * 4;
            dst[di] = raw[si + 2];
            dst[di + 1] = raw[si + 1];
            dst[di + 2] = raw[si];
            dst[di + 3] = raw[si + 3];
        }
    }
    out
}

struct Capturer {
    stop_flag: Arc<AtomicBool>,
    callback: FrameCallback,
}

impl GraphicsCaptureApiHandler for Capturer {
    type Flags = (Arc<AtomicBool>, FrameCallback);
    type Error = Box<dyn std::error::Error + Send + Sync>;

    fn new(context: Context<Self::Flags>) -> std::result::Result<Self, Self::Error> {
        let (stop_flag, callback) = context.flags;
        Ok(Self { stop_flag, callback })
    }

    fn on_frame_arrived(
        &mut self,
        frame: &mut Frame,
        capture_control: InternalCaptureControl,
    ) -> std::result::Result<(), Self::Error> {
        if self.stop_flag.load(Ordering::SeqCst) {
            capture_control.stop();
            return Ok(());
        }

        let width = frame.width();
        let height = frame.height();
        let mut buffer = frame.buffer()?;
        let raw = buffer.as_raw_buffer();

        const mut out = pack_rgba_frame(raw, width, height);

        self.callback
            .call(Ok(out.into()), ThreadsafeFunctionCallMode::NonBlocking);

        Ok(())
    }

    fn on_closed(&mut self) -> std::result::Result<(), Self::Error> {
        Ok(())
    }
}

pub fn run_capture(
    hwnd: i64,
    stop_flag: Arc<AtomicBool>,
    callback: FrameCallback,
) -> std::result::Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let window = Window::from_raw_hwnd(hwnd as *mut std::ffi::c_void);

    let settings = Settings::new(
        window,
        CursorCaptureSettings::WithoutCursor,
        DrawBorderSettings::WithoutBorder,
        SecondaryWindowSettings::Default,
        MinimumUpdateIntervalSettings::Default,
        DirtyRegionSettings::Default,
        ColorFormat::Bgra8,
        (stop_flag, callback),
    );

    Capturer::start(settings)?;
    Ok(())
}

pub fn pid_from_hwnd(hwnd: i64) -> Result<u32> {
    let mut pid: u32 = 0;
    unsafe {
        let result = GetWindowThreadProcessId(HWND(hwnd as *mut _), Some(&mut pid));
        if result == 0 {
            return Err(Error::new(
                napi::Status::GenericFailure,
                "GetWindowThreadProcessId falhou".to_string(),
            ));
        }
    }
    Ok(pid)
}
