brew install postgresql@18

Warning: postgresql@18 was installed but not linked because postgresql@14 is already linked.
To link this version, run:
brew link postgresql@18
==> /opt/homebrew/Cellar/postgresql@18/18.3/bin/initdb --locale=en_US.UTF-8 -E UTF-8 /opt/homebrew/var/postgresql@18
==> Caveats
This formula has created a default database cluster with:
initdb --locale=en_US.UTF-8 -E UTF-8 /opt/homebrew/var/postgresql@18

When uninstalling, some dead symlinks are left behind so you may want to run:
brew cleanup --prune-prefix

postgresql@18 is keg-only, which means it was not symlinked into /opt/homebrew,
because this is an alternate version of another formula.

If you need to have postgresql@18 first in your PATH, run:
echo 'export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"' >> ~/.zshrc

For compilers to find postgresql@18 you may need to set:
export LDFLAGS="-L/opt/homebrew/opt/postgresql@18/lib"
export CPPFLAGS="-I/opt/homebrew/opt/postgresql@18/include"

To start postgresql@18 now and restart at login:
brew services start postgresql@18
Or, if you don't want/need a background service you can just run:
LC_ALL="en_US.UTF-8" /opt/homebrew/opt/postgresql@18/bin/postgres -D /opt/homebrew/var/postgresql@18
==> Summary
🍺  /opt/homebrew/Cellar/postgresql@18/18.3: 3,868 files, 78.0MB
==> Running `brew cleanup postgresql@18`...
Disable this behaviour by setting `HOMEBREW_NO_INSTALL_CLEANUP=1`.
Hide these hints with `HOMEBREW_NO_ENV_HINTS=1` (see `man brew`).
Removing: /opt/homebrew/Cellar/postgresql/14.22... (3,337 files, 48.3MB)
Error: Not a directory @ dir_s_rmdir - /opt/homebrew/Cellar/postgresql
stevepodell@Steves-MBP-M1-Dec2021 weconnect-server % 


---------------
SHOW server_version;
14.22 (Homebrew)
-----------------
