param(
  [string]$Original = (Join-Path $PSScriptRoot '..\assets\field-photo-e-gate.png'),
  [string]$Outer = (Join-Path $PSScriptRoot '..\assets\field-photo-a-outer-candidate.png'),
  [string]$Output = (Join-Path $PSScriptRoot '..\assets\field-photo-a-uniform-source.png')
)

# Preserve every original pixel inside the A driving centreline, including the
# full D/E terrain and their curbs. Only the exterior half of A comes from the
# image-generated outer-wall edit. The transition lies in brown track texture.
Add-Type -ReferencedAssemblies @('System.Drawing') -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class OriginalInteriorComposite {
  static readonly PointF[] Boundary = new PointF[] {
    new PointF(347,385),new PointF(285,423),new PointF(243,458),
    new PointF(237,492),new PointF(278,534),new PointF(335,560),
    new PointF(392,566),new PointF(449,547),new PointF(508,509),
    new PointF(587,457),new PointF(669,404),new PointF(745,354),
    new PointF(768,337),new PointF(741,311),new PointF(696,284),
    new PointF(641,259),new PointF(589,245),new PointF(543,260),
    new PointF(446,336)
  };
  static bool Inside(int x,int y) {
    bool inside=false;
    for(int i=0,j=Boundary.Length-1;i<Boundary.Length;j=i++) {
      PointF a=Boundary[i],b=Boundary[j];
      if((a.Y>y)!=(b.Y>y) && x<(b.X-a.X)*(y-a.Y)/(b.Y-a.Y)+a.X)inside=!inside;
    }
    return inside;
  }
  static float Distance(int x,int y) {
    float best=float.MaxValue;
    for(int i=0;i<Boundary.Length;i++) {
      PointF a=Boundary[i],b=Boundary[(i+1)%Boundary.Length];
      float dx=b.X-a.X,dy=b.Y-a.Y;
      float t=Math.Max(0,Math.Min(1,((x-a.X)*dx+(y-a.Y)*dy)/(dx*dx+dy*dy)));
      float px=x-a.X-t*dx,py=y-a.Y-t*dy;
      best=Math.Min(best,px*px+py*py);
    }
    return (float)Math.Sqrt(best);
  }
  static float Smooth(float a,float b,float v) {
    float t=Math.Max(0,Math.Min(1,(v-a)/(b-a)));
    return t*t*(3-2*t);
  }
  static Bitmap Argb(string path) {
    using(Bitmap source=new Bitmap(path)) {
      Bitmap result=new Bitmap(source.Width,source.Height,PixelFormat.Format32bppArgb);
      using(Graphics g=Graphics.FromImage(result))g.DrawImageUnscaled(source,0,0);
      return result;
    }
  }
  public static void Build(string original,string outer,string output) {
    using(Bitmap source=Argb(original),edit=Argb(outer)) {
      if(source.Width!=edit.Width||source.Height!=edit.Height)throw new Exception("Image sizes differ");
      int w=source.Width,h=source.Height;
      Rectangle rect=new Rectangle(0,0,w,h);
      BitmapData s=source.LockBits(rect,ImageLockMode.ReadWrite,PixelFormat.Format32bppArgb);
      BitmapData e=edit.LockBits(rect,ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
      try {
        int n=s.Stride*h;byte[] a=new byte[n],b=new byte[n];
        Marshal.Copy(s.Scan0,a,0,n);Marshal.Copy(e.Scan0,b,0,n);
        for(int y=0;y<h;y++)for(int x=0;x<w;x++) {
          if(Inside(x,y))continue;
          float d=Distance(x,y);
          float alpha=Smooth(0,18,d)*(1-Smooth(150,210,d));
          if(alpha<.001f)continue;
          int p=y*s.Stride+x*4;
          for(int c=0;c<3;c++)a[p+c]=(byte)Math.Round(a[p+c]*(1-alpha)+b[p+c]*alpha);
        }
        byte[] baseOut=new byte[n];
        Array.Copy(a,baseOut,n);
        float cx=335f,cy=339f,ux=0.841f,uy=-0.541f,nx=0.541f,ny=0.841f;
        for(int y=290;y<385;y++)for(int x=280;x<400;x++) {
          float rx=x-cx,ry=y-cy,along=rx*ux+ry*uy,across=rx*nx+ry*ny;
          float weight=Smooth(-28f,-18f,along)*(1f-Smooth(16f,26f,along))*Smooth(-11f,-6f,across)*(1f-Smooth(8f,14f,across));
          if(weight<.001f)continue;
          int sx=(int)Math.Round(x-26f*ux),sy=(int)Math.Round(y-26f*uy);
          int pDst=y*s.Stride+x*4,pSrc=sy*s.Stride+sx*4;
          for(int c=0;c<3;c++)a[pDst+c]=(byte)Math.Round(baseOut[pDst+c]*(1f-weight)+baseOut[pSrc+c]*weight);
        }
        Marshal.Copy(a,0,s.Scan0,n);
      } finally {source.UnlockBits(s);edit.UnlockBits(e);}
      source.Save(output,ImageFormat.Png);
    }
  }
}
'@

[OriginalInteriorComposite]::Build((Resolve-Path -LiteralPath $Original).Path,(Resolve-Path -LiteralPath $Outer).Path,$Output)
Write-Output $Output
