export const workshop={
 survey:[
 ['type','name','label::English (en)','label::日本語 (ja)','hint::English (en)','hint::日本語 (ja)','required','relevant'],
 ['select_one tracks','track','Which workshop are you joining?','参加するワークショップは？','','','yes',''],
 ['select_one yesno','loan','Do you need a loan kit?','道具セットを借りますか？','','','yes',''],
 ['text','print_experience','Tell us about your printing experience.','版画の経験を教えてください。','Write the response on the answer sheet.','回答用紙に記入してください。','','${track} = \'print\''],
 ['text','book_experience','Tell us about your bookbinding experience.','製本の経験を教えてください。','Write the response on the answer sheet.','回答用紙に記入してください。','','${track} = \'book\''],
 ['select_one slots','pickup','When will you collect your loan kit?','道具セットを受け取る時間は？','','','yes','${loan} = \'yes\''],
 ['note','morning_note','Morning pickup: come to the front desk at 09:00.','午前の受取：9時に受付へお越しください。','','','','${loan} = \'yes\' and ${pickup} = \'morning\''],
 ['note','evening_note','Evening pickup: come to the front desk at 17:00.','夕方の受取：17時に受付へお越しください。','','','','${loan} = \'yes\' and ${pickup} = \'evening\''],
 ['note','packing_note','Please bring a bag for your materials.','材料を持ち帰る袋をご用意ください。','','','','${track} = \'book\' or ${loan} = \'yes\''],
 ['text','final_comment','Anything else the organizer should know?','主催者に伝えたいことはありますか？','','','','']
 ],
 choices:[['list_name','name','label::English (en)','label::日本語 (ja)'],['tracks','print','Print','版画'],['tracks','book','Bookbinding','製本'],['yesno','yes','Yes','はい'],['yesno','no','No','いいえ'],['slots','morning','Morning','午前'],['slots','evening','Evening','夕方']],
 settings:[['form_title','form_id','version','default_language'],['Workshop intake','workshop_intake','20261004','English (en)']]
};
export const expectedHistories=[
 {answers:{track:'print',loan:'no'},questions:['track','loan','print_experience','final_comment']},
 {answers:{track:'book',loan:'no'},questions:['track','loan','book_experience','packing_note','final_comment']},
 ...['print','book'].flatMap(track=>['morning','evening'].map(pickup=>({answers:{track,loan:'yes',pickup},questions:['track','loan',track==='print'?'print_experience':'book_experience','pickup',pickup+'_note','packing_note','final_comment']})))
];
