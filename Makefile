FILES = $(wildcard src/*.css src/*.js src/*.html src/*.json src/assets/*)

default: Url-Share.crx

Url-Share.crx: $(FILES)
	@echo Creating crx file: $@
	@chromium --pack-extension=src --pack-extension-key=Url-Share.pem
	@mv src.crx Url-Share.crx
