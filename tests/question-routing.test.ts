import test from 'node:test';
import assert from 'node:assert/strict';
import {answer,answerFor} from '../lib/evidence.ts';
const cases:[string,string|null][]=[
 ['How are merchants receiving payments in Yaba?','payments'],
 ['Do merchants keep track of their sales records?','records'],
 ['Are trading conditions improving?','business'],
 ['Are restocking costs changing?','restock'],
 ['How common is business borrowing?','credit'],
 ['Do businesses accept remote orders?','remote'],
 ['Where does ERI have evidence today?','coverage'],
 ['What is the market share of POS?',null],
 ['What is the inflation rate?',null],
 ['How are payments in Kano?',null],
 ['What is the profit margin?',null],
 ['Compare payment and credit adoption',null],
 ['Is this representative of Nigeria?',null],
 ['Can you forecast sales?',null],
 ['possible outcomes',null],
 ['Hello',null],
];
for(const [question,expected] of cases)test(question,()=>assert.equal(answer(question)?.id??null,expected));
test('unknown selected location is refused',()=>assert.equal(answerFor('How are payments?','kano')?.id??null,null));
