import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseNextStep,validatePasswordPair} from '../src/identity-setup-rules.js';
test('convite exige token e nunca é interpretado como sessão',()=>{
 assert.equal(chooseNextStep({type:'invite',token:'sample',user:null}),'invite');
 assert.equal(chooseNextStep({type:'invite',user:null}),'invalid');
});
test('recuperação aceita sessão autenticada',()=>{
 assert.equal(chooseNextStep({type:'recovery',user:{email:'editor@example.test'}}),'recovery');
 assert.equal(chooseNextStep({type:'recovery',user:null}),'invalid');
});
test('links desconhecidos não permitem definir senha',()=>{
 assert.equal(chooseNextStep(null),'invalid');
 assert.equal(chooseNextStep({type:'confirmation',user:{}}),'confirmed');
});
test('confirmação e tamanho da senha são verificados',()=>{
 assert.match(validatePasswordPair('short','short'),/12/);
 assert.match(validatePasswordPair('twelvecharacters','differentpassword'),/iguais/);
 assert.equal(validatePasswordPair('twelvecharacters','twelvecharacters'),'');
});
