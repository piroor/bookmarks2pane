#!/bin/sh

appname=bookmarks2pane

cp buildscript/makexpi.sh ./
./makexpi.sh $appname version=0
rm ./makexpi.sh

