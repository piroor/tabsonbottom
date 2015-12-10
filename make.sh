#!/bin/sh

appname=tabsonbottom

cp makexpi/makexpi.sh ./
./makexpi.sh -n $appname -o
rm ./makexpi.sh

