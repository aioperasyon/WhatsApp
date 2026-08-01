const fs=require('fs');
const file='src/main/ipc/register-campaign-ipc.ts';
if(!fs.existsSync(file)) throw new Error('Dosya bulunamadi: '+file);
fs.copyFileSync(file,`${file}.before-package-13f-68.bak`);
let src=fs.readFileSync(file,'utf8');
const fn='function reportCampaignAccountUtilizationSnapshot(): void';
if(!src.includes(fn)){
const marker='function reportCampaignUnassignedAccountSnapshot(): void';
const idx=src.indexOf(marker);
if(idx===-1) throw new Error('13F-67 gerekli.');
const add=`function reportCampaignAccountUtilizationSnapshot(): void {
 const db=getDatabase();
 try{
  const row=db.prepare(\`SELECT COUNT(DISTINCT account_id) AS account_count, COUNT(*) AS active_count FROM campaign_recipients WHERE status IN ('pending','sending') AND account_id IS NOT NULL AND TRIM(account_id)<>''\`).get();
  const accounts=Number(row.account_count??0);
  const active=Number(row.active_count??0);
  const avg=accounts>0?active/accounts:0;
  console.info(\`[Campaign Engine] Hesap kullanım özeti: aktif hesap=\${accounts}, aktif alıcı=\${active}, hesap başına ortalama=\${avg.toFixed(2)}.\`);
  if(accounts>0&&avg>500) console.warn('[Campaign Engine] Hesap başına aktif yük oldukça yüksek görünüyor.');
 }catch(reason){
  const message=reason instanceof Error?reason.message:'Hesap kullanım özeti başarısız.';
  console.error(\`[Campaign Engine] \${message}\`);
 }
}
`;
src=src.slice(0,idx)+add+src.slice(idx);}
if(!src.includes('  reportCampaignAccountUtilizationSnapshot();')){
const a='  reportCampaignUnassignedAccountSnapshot();';
const i=src.indexOf(a);
if(i===-1) throw new Error('Çağrı bulunamadı.');
src=src.slice(0,i+a.length)+'\n  reportCampaignAccountUtilizationSnapshot();'+src.slice(i+a.length);}
fs.writeFileSync(file,src,'utf8');