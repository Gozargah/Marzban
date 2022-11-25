# DO NOT RUN THIS SCRIPT
# This supposed to be used for development


import io
import os
import re
import sys
import tarfile
import tempfile
from pathlib import Path

import requests
from genericpath import isdir

# Compile proto files from github repository


def compile_proto_from_source(dist):
    tmp = tempfile.TemporaryDirectory()
    tmp_dir = tmp.name

    # download and extract source
    print("Getting latest version...")
    latest = requests.get('https://api.github.com/repos/XTLS/xray-core/releases/latest') \
        .json() \
        .get('tag_name')
    print("Latest version is", latest)

    # version = 'v4.45.2'
    version = latest

    print("Downloading source", version, "...")
    download_url = f'https://github.com/XTLS/xray-core/archive/refs/tags/{version}.tar.gz'
    print("Source downloaded. extracting and compiling...")
    r = requests.get(download_url, stream=True)
    io_bytes = io.BytesIO(r.content)
    tar = tarfile.open(fileobj=io_bytes, mode='r')
    tar.extractall(tmp_dir)
    v2ray_dir = os.path.join(tmp_dir, tar.getnames()[0])
    tar.close()
    io_bytes.close()

    # find proto files
    proto_files = ''
    for root, dirs, files in os.walk(tmp_dir):
        for file in files:
            if file.endswith(".proto"):
                proto_files += ' ' + os.path.join(root, file)

    if not proto_files:
        raise FileNotFoundError("there's no proto file.")

    command = f'{sys.executable} -m grpc.tools.protoc ' \
        f'-I={v2ray_dir} ' \
        f'--python_out={dist} ' \
        f'--grpc_python_out={dist} ' + proto_files

    os.system(command)

    tmp.cleanup()
    print("Compile ended.")


def fix_proto_imports(dist):
    curr_dir = Path(__file__).resolve().parent
    parent_dir = curr_dir.parent

    imports = []
    for f in os.listdir('.'):
        if os.path.isdir(f) and not f.startswith('__'):
            imports.append(f)

    new_imp = f'{parent_dir.name}.{curr_dir.name}.' + '{}'

    for root, dirs, files in os.walk('.'):
        for file in files:
            if file == 'compile.py':
                continue

            if file.endswith(".py"):
                path = Path(root) / file
                with open(path, 'r') as pyfile:
                    content = pyfile.read()
                    for imp in imports:
                        for found in re.findall(f'from {imp}', content):
                            content = content.replace(found, "from " + new_imp.format(imp))
                        for found in re.findall(f'import_module\(\'{imp}', content):
                            content = content.replace(found, "import_module('" + new_imp.format(imp))

                    # Only for v2fly
                    content = content.replace('\nimport config_pb2', "\nimport " + new_imp.format('config_pb2'))

                with open(path, 'w') as pyfile:
                    pyfile.write(content)


if __name__ == "__main__":
    print("Compiling source...")
    compile_proto_from_source('.')
    print("Fixing imports...")
    fix_proto_imports('.')
    print("Done.")
