#!/bin/sh

appname=tabsonbottom

cp buildscript/makexpi.sh ./
./makexpi.sh -n $appname -o
rm ./makexpi.sh

