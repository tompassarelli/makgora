# Smashcraft host tools

`smashcraft-tools TOOL [ARGUMENT]...` holds Smashcraft's host-side tools, which
were shell scripts. Each tool keeps its arguments, output lines and exit codes.

## Build

Rust 1.96.1 (`smashcraft:tools/smashcraft-tools/rust-toolchain.toml`) and a C
linker. On this workstation, from the repository root:

```sh
nix shell nixpkgs#gcc --command env PATH="$HOME/.rustup/toolchains/1.96.1-x86_64-unknown-linux-gnu/bin:$PATH" \
  cargo build --release --locked --jobs 2 --manifest-path tools/smashcraft-tools/Cargo.toml
```

The binary is `tools/smashcraft-tools/target/release/smashcraft-tools`. It
reads recipes and scripts from the checkout it was built from. `cargo test --locked` in this folder runs the tests; CI runs them
in smashcraft:.github/workflows/tools.yml.

## Tools

- `wc3-procedure RUN_DIR STATE RECIPE` and `wc3-procedure --validate STATE RECIPE`:
  smashcraft:docs/wc3-procedures.md. Needs `xdotool`.
- `wc3-screen-state IMAGE [compact|full]`, `bench-wc3-screen-state FIXTURE_DIR`
  and `wc3-wait-state RUN_DIR EXPECTED_STATE TIMEOUT_SECONDS`:
  smashcraft:docs/wc3-screen-state.md. Need `magick` and `tesseract`.
- `wc3-auth-transport LAUNCHER_PID`: smashcraft:docs/warcraft-authentication.md.
  Needs `ip` and `ss`.
- `extract-animation-assets` and `build-animation-assets`: extract Rifleman's
  model and textures to `build/animation-assets/`, then author and package his
  clips (smashcraft:docs/fighter-animation-work.md). Need `g++`, `bun`,
  `magick` and, to build, `blender`.
- `extract-demonhunter`: the Demon Hunter model and textures to
  `build/illidan-assets/`. Builds the CascLib extractor with `CXX` (default
  `g++`) unless `CASC_EXTRACTOR` names an executable one.
- `build-lichking [INPUTS] [EXISTING_MODEL] [--replace NAME]...`: Lich King
  clips on the imported model (smashcraft:docs/commands/animation.md).

The extractors read `CASC_SOURCE` (the CascLib checkout) and `WC3_STORAGE` (the
installed game) and default to this workstation's paths.
