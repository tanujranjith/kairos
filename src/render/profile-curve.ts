/** Shape-preserving cubic profile in metres. Non-uniform station spacing must
 * not change the tangent on either side of the same authored station. */
export function profileCurve(points:readonly (readonly [number,number])[]){
  if(points.length<2||points.some((p,i)=>!p.every(Number.isFinite)||i>0&&p[0]<=points[i-1][0]))throw new Error('Profile stations must be finite and strictly increasing.');
  const x=points.map(p=>p[0]),y=points.map(p=>p[1]),h=x.slice(1).map((v,i)=>v-x[i]),delta=h.map((v,i)=>(y[i+1]-y[i])/v),n=x.length;
  const end=(a:number,b:number,da:number,db:number)=>{const m=((2*a+b)*da-a*db)/(a+b);return Math.sign(m)!==Math.sign(da)?0:Math.sign(da)!==Math.sign(db)&&Math.abs(m)>Math.abs(3*da)?3*da:m;};
  const slopes=Array<number>(n);
  slopes[0]=n===2?delta[0]:end(h[0],h[1],delta[0],delta[1]);
  slopes[n-1]=n===2?delta[0]:end(h[n-2],h[n-3],delta[n-2],delta[n-3]);
  for(let i=1;i<n-1;i++){
    const a=delta[i-1],b=delta[i],w1=2*h[i]+h[i-1],w2=h[i]+2*h[i-1];
    slopes[i]=a*b<=0?0:(w1+w2)/(w1/a+w2/b);
  }
  const interval=(position:number)=>{let i=0;while(i<n-2&&position>x[i+1])i++;return i;};
  return {
    at(position:number){
      if(position<=x[0])return y[0];if(position>=x[n-1])return y[n-1];
      const i=interval(position),t=(position-x[i])/h[i],t2=t*t,t3=t2*t;
      return (2*t3-3*t2+1)*y[i]+(t3-2*t2+t)*h[i]*slopes[i]+(-2*t3+3*t2)*y[i+1]+(t3-t2)*h[i]*slopes[i+1];
    },
    derivative(position:number){
      const i=interval(position),t=Math.max(0,Math.min(1,(position-x[i])/h[i])),t2=t*t;
      return (6*t2-6*t)*(y[i]-y[i+1])/h[i]+(3*t2-4*t+1)*slopes[i]+(3*t2-2*t)*slopes[i+1];
    },
  };
}
