import sys, numpy as np
from PIL import Image, ImageFilter
def edges(profile, c, lo, hi):
    d=np.diff(profile); 
    left=lo+int(np.argmax(d[lo:c]))+1      # strongest rise before centre
    right=c+int(np.argmin(d[c:hi]))        # strongest fall after centre (last sheet pixel)
    return left,right
def detect(path, cx, cy, hw, hh):
    im=Image.open(path).convert('L'); W,H=im.size
    a=np.asarray(im.filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)
    px,py=int(cx*W),int(cy*H); bx,by=int(0.03*W),int(0.03*H)
    xs=[];ys=[]
    for off in (-2,-1,0,1,2):
        r=a[py+off*by-8:py+off*by+8].mean(0); xs.append(edges(r,px,int((cx-hw)*W),int((cx+hw)*W)))
        c=a[:,px+off*bx-8:px+off*bx+8].mean(1); ys.append(edges(c,py,int((cy-hh)*H),int((cy+hh)*H)))
    xs=np.array(xs);ys=np.array(ys)
    x0,x1=int(np.median(xs[:,0])),int(np.median(xs[:,1])); y0,y1=int(np.median(ys[:,0])),int(np.median(ys[:,1]))
    print(path,'x',xs.T.tolist(),'y',ys.T.tolist()); print(' bbox',x0,y0,x1-x0+1,y1-y0+1,'ratio %.4f'%((x1-x0+1)/(y1-y0+1)))
detect(sys.argv[1],*map(float,sys.argv[2:6]))
