import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
def comp(room, planner, out, scale=2):
    im=Image.open(room).convert('RGB'); W,H=im.size
    im=im.resize((W*scale,H*scale),Image.LANCZOS); a=np.asarray(im).astype(np.float32)
    mn=a.min(2); mx=a.max(2)
    white=(mn>205)&((mx-mn)<22)
    lab,n=ndimage.label(white)
    sizes=ndimage.sum(white,lab,range(1,n+1)); k=int(np.argmax(sizes))+1
    m=ndimage.binary_fill_holes(lab==k)
    m=ndimage.binary_opening(m,iterations=3)
    ys,xs=np.where(m); 
    # robust bbox: rows/cols where coverage > 60%
    cols=m.sum(0); rows=m.sum(1)
    x0,x1=np.where(cols>0.6*cols.max())[0][[0,-1]]; y0,y1=np.where(rows>0.6*rows.max())[0][[0,-1]]
    bw,bh=x1-x0+1,y1-y0+1
    pw,ph=Image.open(planner).size; want=int(round(bw*ph/pw))
    if abs(want-bh)/bh>0.025 and want>bh:
        ext=want-bh
        # shift the sheet's bottom edge strip (edge + shadow) down by ext, fill the gap with paper
        band=24
        strip=a[y1-4:y1+band].copy(); a[y1-4+ext:y1+band+ext]=strip
        a[y1-4:y1-4+ext, x0:x1+1]=a[y1-12:y1-11, x0:x1+1]
        m[y1-4:y1+ext-2, x0+2:x1-1]=True; m[y1+ext-2:, :]=False if False else m[y1+ext-2:, :]
        y1=y1+ext-3; bh=y1-y0+1
    p=Image.open(planner).convert('RGB').resize((bw,bh),Image.LANCZOS)
    pa=np.asarray(p).astype(np.float32)
    region=a[y0:y1+1,x0:x1+1]
    lum=region.mean(2,keepdims=True)
    ref=np.percentile(lum[m[y0:y1+1,x0:x1+1]],90)
    shade=np.clip(lum/ref,0.55,1.03)
    shade=np.asarray(Image.fromarray((shade[...,0]*200).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)[...,None]/200
    blended=np.clip(pa*shade,0,255)
    mask=Image.fromarray((m[y0:y1+1,x0:x1+1]*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    mk=np.asarray(mask).astype(np.float32)[...,None]/255
    a[y0:y1+1,x0:x1+1]=region*(1-mk)+blended*mk
    Image.fromarray(a.astype(np.uint8)).save(out,quality=88)
    print(out,'bbox',x0,y0,bw,bh,'ratio %.3f'%(bw/bh),'cover %.2f'%(m.sum()/(bw*bh)))
comp(*sys.argv[1:4])
