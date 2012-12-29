#!/bin/sh

appname=bookmarks2pane

cp buildscript/makexpi.sh ./
./makexpi.sh -n $appname -o
rm ./makexpi.sh

