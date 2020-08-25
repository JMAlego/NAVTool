pushd () {
    command pushd "$@" > /dev/null
}

popd () {
    command popd "$@" > /dev/null
}

location="`dirname \"$0\"`"
abslocation="`( cd \"$location\" && pwd )`"
package="`basename $abslocation`"

# If using a different name for ".venv" consider changing this
if [ -d "$location/.venv/bin" ]; then
  source "$location/.venv/bin/activate"
fi

pushd ..

python -m $package $*

popd
