export function clampCampaignDelay(delayMs:number):number{return Math.max(0,delayMs);}
export async function waitCampaignDelay(delayMs:number):Promise<void>{const d=clampCampaignDelay(delayMs);if(d===0)return;await new Promise<void>(r=>setTimeout(r,d));}
