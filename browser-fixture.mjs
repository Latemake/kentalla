// Browser test data is created explicitly; production never seeds players.
export async function seedTestTeam(evaluate) {
  await evaluate(`(()=>{
    if(JSON.parse(localStorage.getItem('kentalla-v1')).players.length)return;
    document.querySelector('[data-tab="pelaajat"]').click();
    for(let i=1;i<=12;i++){
      document.querySelector('[data-action="add-player"]').click();
      const form=document.querySelector('#player-form');
      form.elements.name.value='Test player '+i;
      form.elements.number.value=String(i);
      form.requestSubmit();
    }
    document.querySelector('[data-tab="ottelu"]').click();
    document.querySelector('[data-action="new"]').click();
    document.querySelector('#match-form').requestSubmit();
  })()`);
}
