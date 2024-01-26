PWD = $(shell pwd)

clean:
	source make_shell.sh; clean "$(PWD)"

build: clean
	echo "$(PWD)"
	source make_shell.sh; build_shell "$(PWD)"

shell:
	echo "$(PWD)"
	source make_shell.sh; run_shell "$(PWD)"

.PHONY: build