{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      addonPin = pkgs.lib.trim (builtins.readFile ./tools/animations/mdl-exporter4.pin);
    in {
      devShells.${system}.default = pkgs.mkShell {
        packages = [ pkgs.blender ];
        shellHook = ''
          export WC3_MDL_ADDON="$HOME/.local/share/smashcraft-build-inputs/store/mdl-exporter4/${addonPin}"
          if [ ! -d "$WC3_MDL_ADDON" ]; then
            echo "Missing pinned mdl-exporter4 input: $WC3_MDL_ADDON" >&2
            exit 1
          fi
        '';
      };
    };
}
