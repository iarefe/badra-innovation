export const challengeLibraryPath='/challenges';
export const myChallengesPath=challengeLibraryPath+'?tab=mine';
export const myChallengesLoginPath='/login?next='+encodeURIComponent(myChallengesPath);
export function collectionRoute(tab?:string|string[]|null){return (Array.isArray(tab)?tab[0]:tab)==='mine'?'mine':'wall';}
export function isCollectionRoute(route:string){return route==='wall'||route==='mine';}
export function routePath(route:string){
 if(route.startsWith('complete/'))return '/challenge/'+route.slice(9)+'/complete';
 if(route.startsWith('challenge/'))return '/'+route;
 return ({home:'/',wall:challengeLibraryPath,new:'/submit',mine:myChallengesPath,admin:'/admin',login:'/login',account:'/account',archive:'/archive'} as Record<string,string>)[route]||'/';
}
export function pathRoute(path:string){
 const [pathname,query]=path.split('#',1)[0].split('?'),name=pathname.replace(/\/$/,'')||'/';
 if(name===challengeLibraryPath)return collectionRoute(new URLSearchParams(query).get('tab'));
 if(name==='/my-challenges')return 'mine'; // Bookmarks and old sign-in return URLs.
 const complete=name.match(/^\/challenge\/([^/]+)\/complete$/);if(complete)return 'complete/'+complete[1];
 if(/^\/challenge\/[^/]+$/.test(name))return name.slice(1);
 return ({'/':'home','/submit':'new','/admin':'admin','/login':'login','/account':'account','/archive':'archive'} as Record<string,string>)[name]||'not-found';
}
