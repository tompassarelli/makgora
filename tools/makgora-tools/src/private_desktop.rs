use std::fs;
use std::os::unix::fs::{FileTypeExt, MetadataExt};
use std::path::Path;

pub fn effective_uid() -> u32 {
    unsafe { libc::geteuid() }
}

pub fn is_run_directory(path: &str) -> bool {
    path.starts_with(&format!("/run/user/{}/private-desktop.", effective_uid()))
}

pub fn is_owned(path: &Path) -> bool {
    fs::metadata(path).is_ok_and(|metadata| metadata.uid() == effective_uid())
}

pub fn has_wayland(run_directory: &Path) -> bool {
    fs::metadata(run_directory.join("runtime/wayland-0"))
        .is_ok_and(|metadata| metadata.file_type().is_socket())
}
