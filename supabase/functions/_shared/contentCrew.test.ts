import assert from "node:assert/strict";
import { it } from "node:test";
import { mapAniListStaff, mapTmdbCrew, parseStoredCrew, serializeCrewForStorage, type CrewMemberMeta, type CrewRole } from "./contentCrew.ts";

it("T-1 maps exact jobs, orders roles and deduplicates within each role", () => {
  const result = mapTmdbCrew([
    {id:1,name:"봉준호",job:"Director"}, {id:2,name:"김성식",job:"Assistant Director"},
    {id:1,name:"봉준호",job:"Story"}, {id:1,name:"봉준호",job:"Screenplay"},
    {id:3,name:"한진원",job:"Screenplay"}, {id:4,name:"이정훈",job:"Second Unit Director"},
    {id:5,name:"김대환",job:"Adaptation"}
  ]);
  assert.deepEqual(result.map(({id,role,name,job}) => ({id,role,name,job})), [
    {id:1,role:"director",name:"봉준호",job:"Director"},
    {id:1,role:"writer",name:"봉준호",job:"Story"},
    {id:3,role:"writer",name:"한진원",job:"Screenplay"},
    {id:5,role:"writer",name:"김대환",job:"Adaptation"}
  ]);
});
it("T-2 excludes creators when directors or writers exist", () => {
  const result = mapTmdbCrew([{id:10,name:"김은숙",job:"Writer"},{id:11,name:"안길호",job:"Director"}], [{id:10,name:"김은숙"},{id:11,name:"안길호"}]);
  assert.deepEqual(result.map(({id,role,name}) => ({id,role,name})), [{id:11,role:"director",name:"안길호"},{id:10,role:"writer",name:"김은숙"}]);
});
it("T-3 falls back to trimmed creators", () => {
  assert.deepEqual(mapTmdbCrew([], [{id:20,name:" 노희경 "}]), [{id:20,name:"노희경",original_name:null,role:"creator",job:"Creator",profile_url:null}]);
});
it("T-4 discards missing ids and blank names", () => {
  assert.deepEqual(mapTmdbCrew(undefined), []);
  assert.deepEqual(mapTmdbCrew([], []), []);
  assert.deepEqual(mapTmdbCrew([{name:"이름만",job:"Director"},{id:7,name:"  ",job:"Director"}]), []);
});
it("T-5 keeps the first three people per role", () => {
  const result = mapTmdbCrew(["A","B","C","D","E"].map((name,index) => ({id:index+1,name,job:"Director"})));
  assert.deepEqual(result.map(({id,name,role}) => ({id,name,role})), [{id:1,name:"A",role:"director"},{id:2,name:"B",role:"director"},{id:3,name:"C",role:"director"}]);
});
it("T-6 maps original authors and TMDB profile URLs", () => {
  assert.deepEqual(mapTmdbCrew([{id:30,name:"원작자",job:"Novel",profile_path:"/a.jpg"}]), [{id:30,name:"원작자",original_name:null,role:"original",job:"Novel",profile_url:"https://image.tmdb.org/t/p/w185/a.jpg"}]);
});
it("A-1 normalizes parenthesized roles without including action directors", () => {
  const result = mapAniListStaff([
    {role:"Original Story",node:{id:1,name:{native:"山田鐘人",full:"Kanehito Yamada"}}},
    {role:"Director (eps 1-12)",node:{id:2,name:{native:"斎藤圭一郎"}}},
    {role:"Action Director",node:{id:3,name:{native:"岩澤亨"}}},
    {role:"Series Composition",node:{id:4,name:{native:"鈴木智尋"}}}
  ]);
  assert.deepEqual(result, [
    {id:2,name:"斎藤圭一郎",original_name:null,role:"director",job:"Director (eps 1-12)",profile_url:null},
    {id:4,name:"鈴木智尋",original_name:null,role:"writer",job:"Series Composition",profile_url:null},
    {id:1,name:"山田鐘人",original_name:"Kanehito Yamada",role:"original",job:"Original Story",profile_url:null}
  ]);
});
it("A-2 falls back to full names and medium images", () => {
  assert.deepEqual(mapAniListStaff([{role:"Director",node:{id:9,name:{native:null,full:"Ryu Ishikawa"},image:{medium:"m.jpg"}}}]), [{id:9,name:"Ryu Ishikawa",original_name:"Ryu Ishikawa",role:"director",job:"Director",profile_url:"m.jpg"}]);
});
it("A-3 ignores missing staff and unrelated roles", () => {
  assert.deepEqual(mapAniListStaff(undefined), []);
  assert.deepEqual(mapAniListStaff([{role:"Character Design",node:{id:1,name:{native:"X"}}}]), []);
});

function c(id: number, name: string, role: CrewRole): CrewMemberMeta {
  return { id, name, original_name: null, role, job: role, profile_url: null };
}
it("P-1 rejects non-array stored values", () => {
  for (const value of ["x", null, undefined, {}, 42]) assert.deepEqual(parseStoredCrew(value), []);
});
it("P-2 discards invalid stored members", () => {
  assert.deepEqual(parseStoredCrew([c(1,"봉준호","director"), {id:"2",name:"x",role:"director"}, {id:3,name:"  ",role:"writer"}, {id:4,name:"한진원",role:"actor"}, c(5,"한진원","writer")]), [c(1,"봉준호","director"), c(5,"한진원","writer")]);
});
it("P-3 defaults missing optional fields", () => {
  assert.deepEqual(parseStoredCrew([{id:7,name:"이름",role:"writer"}]), [{id:7,name:"이름",original_name:null,role:"writer",job:"",profile_url:null}]);
});
it("P-4 clears malformed original names and profile URLs", () => {
  assert.deepEqual(parseStoredCrew([{...c(8,"A","original"),original_name:3,profile_url:{}}]), [c(8,"A","original")]);
});
it("P-5 orders directors before writers and limits each role", () => {
  const directors = [1,2,3,4,5].map(id => c(id,String(id),"director"));
  assert.deepEqual(parseStoredCrew([c(6,"W","writer"),...directors]), [...directors.slice(0,3),c(6,"W","writer")]);
});
it("P-6 limits all four roles to twelve members", () => {
  const roles: CrewRole[] = ["director","writer","original","creator"];
  const members = roles.flatMap((role,index) => [1,2,3,4].map(id => c(index*4+id,String(id),role)));
  assert.deepEqual(parseStoredCrew(members), roles.flatMap(role => members.filter(member => member.role===role).slice(0,3)));
  assert.equal(parseStoredCrew(members).length,12);
});
it("P-7 serializes without duplicate ids and accepts missing crew", () => {
  assert.deepEqual(serializeCrewForStorage([c(1,"A","director"),c(1,"A","director"),c(2,"B","writer")]), [c(1,"A","director"),c(2,"B","writer")]);
  assert.deepEqual(serializeCrewForStorage(undefined), []);
});
