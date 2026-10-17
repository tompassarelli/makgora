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
    let trigger_press = contract["thresholds"]["triggerPress"].as_u64().expect("triggerPress");
    out += &format!("pub const TRIGGER_PRESS_LEVEL: u16 = {};\n", u16::try_from(trigger_press).expect("triggerPress fits a u16 trigger"));
    fs::write(PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("controller_contract.rs"), out).unwrap();
}
