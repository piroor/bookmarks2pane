#!/bin/sh

appname=bookmarks2pane

cp makexpi/makexpi.sh ./
./makexpi.sh -n $appname -o
rm ./makexpi.sh

