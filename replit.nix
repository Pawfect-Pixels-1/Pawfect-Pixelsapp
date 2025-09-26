{ pkgs }: {
  deps = [
    pkgs.nodejs_22          # Node.js runtime
    pkgs.nodePackages.npm   # npm CLI
    pkgs.git                # git client
    pkgs.cacert             # SSL certs
    # pkgs.stripe-cli       # optional: only if you want Stripe CLI available in shell
  ];
}