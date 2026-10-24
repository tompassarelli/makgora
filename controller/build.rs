use std::{env, fs, path::PathBuf};

fn main() {
    let path = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap()).join("../contracts/controller.json");
    println!("cargo::rerun-if-changed={}", path.display());
    let text = fs::read_to_string(&path).unwrap_or_else(|error| panic!("read {}: {error}", path.display()));
    let contract: serde_json::Value = serde_json::from_str(&text).unwrap_or_else(|error| panic!("parse {}: {error}", path.display()));
    let constant = |name: &str| name.chars().fold(String::new(), |mut out, c| {
        if c.is_ascii_uppercase() { out.push('_'); }
        out.push(c.to_ascii_uppercase());
        out
    });
    let mut out = String::new();
    let actions = contract["actions"].as_array().expect("actions");
    let mut action_bits = Vec::new();
    for action in actions {
        let name = action["name"].as_str().expect("action name");
        let bit = action["bit"].as_u64().expect("action bit");
        action_bits.push((name, bit));
        out += &format!("pub const {}: u32 = 1 << {bit};\n", constant(name));
    }
    out += "pub const PAD_KEYS: &[(&str, u32)] = &[\n";
    for key in contract["padKeys"].as_array().expect("padKeys") {
        let action = key["action"].as_str().expect("key action");
        assert!(action_bits.iter().any(|(name, _)| *name == action), "pad key names unknown action {action}");
        out += &format!("    ({:?}, {}),\n", key["key"].as_str().expect("key"), constant(action));
    }
    out += "];\n";
    let layouts = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap()).join("../contracts/layouts");
    println!("cargo::rerun-if-changed={}", layouts.display());
    let mut tilt_hold: Option<Vec<String>> = None;
    let mut names = fs::read_dir(&layouts).unwrap_or_else(|error| panic!("read {}: {error}", layouts.display()))
        .map(|entry| entry.unwrap().path()).filter(|path| path.extension().is_some_and(|ext| ext == "json")).collect::<Vec<_>>();
    names.sort();
    for path in names {
        println!("cargo::rerun-if-changed={}", path.display());
        let text = fs::read_to_string(&path).unwrap_or_else(|error| panic!("read {}: {error}", path.display()));
        let layout: serde_json::Value = serde_json::from_str(&text).unwrap_or_else(|error| panic!("parse {}: {error}", path.display()));
        for row in layout["bindings"].as_array().expect("layout bindings") {
            let tilt = row["when"]["setting"] == "rightStick" && row["when"]["value"] == "tilt";
            let hold = row["hold"].as_array().map(|keys| keys.iter().map(|key| {
                let key = key.as_str().expect("hold key");
                let entry = contract["padKeys"].as_array().unwrap().iter().find(|entry| entry["key"] == key)
                    .unwrap_or_else(|| panic!("{} holds unknown pad key {key}", path.display()));
                constant(entry["action"].as_str().unwrap())
            }).collect::<Vec<_>>());
            assert!(tilt || hold.is_none(), "{} holds keys outside rightStick=tilt rows, which the controller cannot press", path.display());
            if !tilt { continue; }
            let hold = hold.unwrap_or_default();
            assert!(tilt_hold.as_ref().is_none_or(|first| *first == hold), "{} disagrees on the rightStick=tilt hold", path.display());
            tilt_hold = Some(hold);
        }
    }
    let tilt_hold = tilt_hold.expect("layouts declare rightStick=tilt rows");
    out += &format!("pub const RIGHT_STICK_TILT_HOLD: u32 = {};\n", if tilt_hold.is_empty() { "0".into() } else { tilt_hold.join(" | ") });
    let trigger_press = contract["thresholds"]["triggerPress"].as_u64().expect("triggerPress");
    out += &format!("pub const TRIGGER_PRESS_LEVEL: u16 = {};\n", u16::try_from(trigger_press).expect("triggerPress fits a u16 trigger"));
    fs::write(PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("controller_contract.rs"), out).unwrap();
}
