use super::*;
use padbridge::{model::{Button, Control, ControllerSettings, InputView, PadKind, PadPreset, Press, RightStick}, service::any_map::{Driver, MenuCurve, Output}};

struct Preset {
    name: String,
    settings: ControllerSettings,
    fight: BTreeMap<Control, Vec<String>>,
    menus: BTreeMap<Control, Vec<String>>,
    map_rows: Vec<serde_json::Value>,
}

fn contract() -> &'static [Preset] {
    static CONTRACT: std::sync::OnceLock<Vec<Preset>> = std::sync::OnceLock::new();
    CONTRACT.get_or_init(|| {
        let path = match std::env::var_os("PADBRIDGE_CONTRACT") {
            Some(path) => PathBuf::from(path),
            None => {
                let metadata = std::process::Command::new("cargo")
                    .args(["metadata", "--locked", "--offline", "--format-version=1", "--filter-platform"])
                    .arg(format!("{}-unknown-linux-gnu", std::env::consts::ARCH))
                    .current_dir(env!("CARGO_MANIFEST_DIR")).output().unwrap();
                assert!(metadata.status.success(), "cannot resolve the pinned controller contract: {}", String::from_utf8_lossy(&metadata.stderr));
                let metadata: serde_json::Value = serde_json::from_slice(&metadata.stdout).unwrap();
                let package = metadata["packages"].as_array().unwrap().iter()
                    .find(|package| package["name"] == "padbridge").unwrap();
                Path::new(package["manifest_path"].as_str().unwrap()).parent().unwrap().join("contract/bindings.json")
            }
        };
        let contract: serde_json::Value = serde_json::from_slice(&fs::read(&path)
            .unwrap_or_else(|error| panic!("read shipped contract {}: {error}", path.display()))).unwrap();
        let labels = contract["map_actions"].as_object().expect("shipped contract must map action labels");
        let outputs = |press: Press| match press {
            Press::Key(key) => vec![key], Press::Pointer => vec!["pointer".into()],
            Press::LeftClick => vec!["left-click".into()], Press::RightClick => vec!["right-click".into()],
        };
        PadPreset::ALL.into_iter().flat_map(|pad_preset| RightStick::ALL.map(|right_stick| (pad_preset, right_stick))).map(|(pad_preset, right_stick)| {
            let settings = ControllerSettings { pad_preset, right_stick, ..ControllerSettings::default() };
            let mut fight = BTreeMap::new();
            let mut map_rows = Vec::new();
            for binding in settings.bindings(PadKind::Xbox) {
                let action = labels.get(&binding.action).unwrap_or_else(|| panic!("contract lacks {}", binding.action)).as_str().unwrap();
                let mut keys = outputs(binding.press);
                for key in &keys {
                    map_rows.push(serde_json::json!({ "preset": pad_preset.name(), "control": binding.control.name(), "key": key, "label": binding.action, "action": action }));
                }
                if right_stick == RightStick::Tilt && matches!(binding.control, Control::RightLeft | Control::RightRight | Control::RightUp | Control::RightDown) { keys.push(padbridge::model::pad_key::TILT.to_string()); }
                fight.insert(binding.control, keys);
            }
            let menus = padbridge::service::any_map::menu_bindings(true).into_iter()
                .map(|binding| (binding.control, outputs(binding.press))).collect();
            Preset { name: format!("{} right-stick {}", pad_preset.name(), right_stick.name()), settings, fight, menus, map_rows }
        }).collect()
    })
}

fn random(seed: &mut u64) -> u32 {
    *seed ^= *seed << 13;
    *seed ^= *seed >> 7;
    *seed ^= *seed << 17;
    (*seed >> 16) as u32
}

fn input(control: Control, magnitude: i16) -> (InputView, evdev::InputEvent) {
    let mut pad = InputView::default();
    let button = match control {
        Control::A => Some((Button::A, Key::BTN_SOUTH)), Control::B => Some((Button::B, Key::BTN_EAST)),
        Control::X => Some((Button::X, Key::BTN_WEST)), Control::Y => Some((Button::Y, Key::BTN_NORTH)),
        Control::Lb => Some((Button::Lb, Key::BTN_TL)), Control::Rb => Some((Button::Rb, Key::BTN_TR)),
        Control::Start => Some((Button::Start, Key::BTN_START)), Control::Back => Some((Button::Back, Key::BTN_SELECT)),
        Control::LeftStick => Some((Button::LeftStick, Key::BTN_THUMBL)),
        Control::DpadUp => Some((Button::DpadUp, Key::BTN_DPAD_UP)), Control::DpadDown => Some((Button::DpadDown, Key::BTN_DPAD_DOWN)),
        Control::DpadLeft => Some((Button::DpadLeft, Key::BTN_DPAD_LEFT)), Control::DpadRight => Some((Button::DpadRight, Key::BTN_DPAD_RIGHT)),
        _ => None,
    };
    if let Some((button, key)) = button {
        pad.press(button, true);
        return (pad, evdev::InputEvent::new(evdev::EventType::KEY.0, key.0, 1));
    }
    let (axis, value) = match control {
        Control::Lt => { pad.lt = magnitude as u16; (Abs::ABS_Z, magnitude) }
        Control::Rt => { pad.rt = magnitude as u16; (Abs::ABS_RZ, magnitude) }
        Control::LeftLeft => { pad.left[0] = -magnitude; (Abs::ABS_X, -magnitude) }
        Control::LeftRight => { pad.left[0] = magnitude; (Abs::ABS_X, magnitude) }
        Control::LeftUp => { pad.left[1] = -magnitude; (Abs::ABS_Y, -magnitude) }
        Control::LeftDown => { pad.left[1] = magnitude; (Abs::ABS_Y, magnitude) }
        Control::RightLeft => { pad.right[0] = -magnitude; (Abs::ABS_RX, -magnitude) }
        Control::RightRight => { pad.right[0] = magnitude; (Abs::ABS_RX, magnitude) }
        Control::RightUp => { pad.right[1] = -magnitude; (Abs::ABS_RY, -magnitude) }
        Control::RightDown => { pad.right[1] = magnitude; (Abs::ABS_RY, magnitude) }
        _ => panic!("contract input is unsupported: {control:?}"),
    };
    (pad, evdev::InputEvent::new(evdev::EventType::ABSOLUTE.0, axis.0, i32::from(value)))
}

#[derive(Default)]
struct Desktop {
    held: BTreeSet<String>,
    cursor: [f64; 2],
}

impl Output for Desktop {
    fn key(&mut self, name: &str, down: bool) -> Result<(), String> {
        if down { self.held.insert(name.into()); } else { self.held.remove(name); }
        Ok(())
    }
    fn click(&mut self, right: bool, down: bool) -> Result<(), String> {
        self.key(if right { "right-click" } else { "left-click" }, down)
    }
    fn pointer(&mut self, x: f64, y: f64) -> Result<(), String> {
        self.cursor[0] += x;
        self.cursor[1] += y;
        Ok(())
    }
}

#[test]
fn generated_fighter_inputs_follow_the_models_shipped_contract_rows() {
    let mut seed = 0x62696e64696e6773;
    let cases = if std::env::var_os("CI").is_some() { 512 } else { 64 };
    let mut failures = BTreeSet::new();
    for preset in contract() {
        for (&control, outputs) in &preset.fight {
            for _ in 0..cases {
                let magnitude = 29_491 + (random(&mut seed) % 3277) as i16;
                let (pad, _) = input(control, magnitude);
                let mut driver = Driver::keys_for(&preset.settings, padbridge::pad_ingress::Route::Digital);
                let mut out = Desktop::default();
                let start = std::time::Instant::now();
                driver.step(&InputView::default(), true, 0.0, start, &mut out).unwrap();
                driver.step(&pad, true, 0.0, start, &mut out).unwrap();
                let wanted = outputs.iter().cloned().collect::<BTreeSet<_>>();
                if out.held != wanted {
                    failures.insert(format!("{} {control:?}: keys {:?}, contract {wanted:?}", preset.name, out.held));
                }
                driver.step(&InputView::default(), true, 0.0, start + padbridge::MIN_HOLD, &mut out).unwrap();
                assert!(out.held.is_empty(), "{} {control:?}: keys remain at neutral", preset.name);
            }
            eprintln!("{} {control:?}: {cases} generated contract cases", preset.name);
        }
    }
    assert!(failures.is_empty(), "binding contract failures: {failures:?}");
}

#[test]
fn every_shipped_contract_key_reaches_its_labelled_map_action_in_defaults_and_k1() {
    let rows = contract().iter().flat_map(|preset| preset.map_rows.iter()).collect::<Vec<_>>();
    let rows = serde_json::to_string(&rows).unwrap();
    if let Some(path) = std::env::var_os("WC3_BINDING_PROJECTION_PATH") { fs::write(path, &rows).unwrap(); }
    let output = std::process::Command::new("bun").args(["test", "test/pad-contract.test.ts"])
        .current_dir(Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().join("ts"))
        .env("WC3_BINDING_ROWS", rows).output().unwrap();
    assert!(output.status.success(), "actual map contract failed:\n{}{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
}

#[test]
fn generated_menus_follow_shipped_rows_and_start_is_independent_of_cursor_position() {
    let mut seed = 0x6d656e7562696e64;
    let cases = if std::env::var_os("CI").is_some() { 512 } else { 64 };
    for preset in contract() {
        for (&control, outputs) in &preset.menus {
            for _ in 0..cases {
                let (pad, _) = input(control, 29_491 + (random(&mut seed) % 3277) as i16);
                let position = [f64::from(random(&mut seed) % 3840), f64::from(random(&mut seed) % 2160)];
                let mut out = Desktop { cursor: position, ..Desktop::default() };
                let mut driver = Driver::menu(MenuCurve::for_window_width(1888.0), true);
                driver.step(&InputView::default(), true, 0.0, std::time::Instant::now(), &mut out).unwrap();
                driver.step(&pad, true, 0.01, std::time::Instant::now(), &mut out).unwrap();
                let wanted = outputs.iter().filter(|key| key.as_str() != "pointer").cloned().collect::<BTreeSet<_>>();
                assert_eq!(out.held, wanted, "{} {control:?}: menu contract", preset.name);
                assert_eq!(out.cursor != position, outputs.iter().any(|key| key == "pointer"), "{control:?}: pointer contract");
                driver.step(&InputView::default(), true, 0.0, std::time::Instant::now(), &mut out).unwrap();
                assert!(out.held.is_empty());
                if control == Control::Start {
                    for phase in [MenuPhase::Character, MenuPhase::Cpu, MenuPhase::Stage, MenuPhase::Result] {
                        let neutral = State { preset: preset.settings.pad_preset, ..State::default() };
                        let mut menu = MenuInput { start_only: true, ..MenuInput::default() };
                        menu.observe(Some(phase), neutral, false, 1);
                        assert_eq!(menu.press(neutral, neutral, false, true, 2), outputs.first().map(String::as_str));
                        assert_eq!(menu.press(neutral, neutral, true, true, 3), None);
                    }
                    assert_eq!(out.cursor, position);
                }
            }
        }
    }
}
