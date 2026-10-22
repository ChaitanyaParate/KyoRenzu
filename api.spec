# -*- mode: python ; coding: utf-8 -*-
import os
import glob

# Collect torchvision CPU native binary extensions and companion libraries
tv_dir = os.path.join(SPECPATH, '.build_venv/lib/python3.12/site-packages/torchvision')
tv_libs_dir = os.path.join(SPECPATH, '.build_venv/lib/python3.12/site-packages/torchvision.libs')

tv_binaries = []
if os.path.exists(tv_dir):
    for so in glob.glob(os.path.join(tv_dir, '*.so')):
        tv_binaries.append((so, 'torchvision'))
if os.path.exists(tv_libs_dir):
    for so in glob.glob(os.path.join(tv_libs_dir, '*.so*')):
        tv_binaries.append((so, 'torchvision.libs'))

a = Analysis(
    ['api.py'],
    pathex=[],
    binaries=tv_binaries,
    datas=[('auto_selector.py', '.')],
    hiddenimports=[
        'PIL',
        'PIL.Image',
        'torch',
        'torchvision',
        'transformers',
        'sentence_transformers',
        'sentence_transformers.models',
        'huggingface_hub',
        'rapidfuzz',
        'cloudscraper',
        'bs4',
        'gdown',
        'appdirs',
        'uvicorn',
        'fastapi',
        'sqlite3',
        'httpx',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'nvidia',
        'triton',
        'scipy',
        'pandas',
        'sklearn',
        'matplotlib',
        'cv2',
        'gradio',
        'gradio_client',
        'numba',
        'llvmlite',
        'tkinter',
        '_tkinter',
        'IPython',
        'ipykernel',
        'jupyter',
        'tensorboard',
        'pytest',
    ],
    noarchive=False,
    optimize=0,
)

# Hardware-Agnostic CPU Filtering: Strip stray CUDA and test binaries
filtered_binaries = []
cuda_patterns = ('cuda', 'cublas', 'cudnn', 'curand', 'cusparse', 'cusolver', 'nvrtc', 'nvshmem', 'libtorch_cuda', 'test')
for name, path, typecode in a.binaries:
    base = name.lower()
    if 'torch_shm_manager' in base:
        filtered_binaries.append((name, path, typecode))
        continue
    if any(pat in base for pat in cuda_patterns) and not ('noncuda' in base):
        continue
    if 'protoc' in base:
        continue
    filtered_binaries.append((name, path, typecode))
a.binaries = filtered_binaries

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='api',
    debug=False,
    bootloader_ignore_signals=False,
    strip=True,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
