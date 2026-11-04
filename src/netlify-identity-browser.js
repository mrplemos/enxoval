// Browser-side authentication uses the same Netlify Identity session as
// invite acceptance and password recovery. Authorization remains server-side.
import {login,logout,getUser} from '@netlify/identity';

globalThis.__enxovalIdentity={
  login:(email,password)=>login(email,password),
  logout:()=>logout(),
  getUser:()=>getUser()
};
