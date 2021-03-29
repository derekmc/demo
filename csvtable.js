
//const csv = require('csv');
const fs = require('fs');
const telnet = require('telnet');

// regexes
const FloatRegex = /^[+-]?\d+(\.\d+)?$/;
const HexRegex = /0x[0-9a-fA-F]+$/;
const BigIntRegex = /^[+-]?\d+n$/;

// If autoid is on, the table is indexed, by an automatically generated id.
// Otherwise, A table is indexed by the first column.
// For a given database, it is recommended not to switch between autoid and manual id.

function Table(headers, options){

  if(!options) options = {};
  if(!headers) headers = [];
  let ids = {};

  checkType(headers, "array");
  checkType(options, "object");

  let quoted = options['quoted']? true : false;
  let autoid = options['autoid']? true : false; // generate an id, instead of using first entry.
  let autoparse = options['autoparse']? true : false;
  let filename = options['filename']? options['filename'] : null;
  let folder = options['folder']? options['folder'] : '.';
  
  fs.mkdirSync(folder, {recursive: true});

  // checkType(quoted, "boolean");
  // checkType(autoid, "boolean");
  // checkType(autoparse, "boolean");
  if(filename) checkType(filename, "string");

  // store autoids for live table no matter what,
  // the autoid prop, just determines whether that is saved.
  let currentAutoId = 1;

  let table = {
    headers: headers,
    rows: [],
    ids: {},
  };


  function checkType(value, type){
    let t = typeof value;
    if(type == "array" || type == "object"){
      t = Array.isArray(value)? "array" : t; }
    if(t != type){
      throw new Error(`csvtable: expected "${type}" got ${value}, with type "${t}".`); }
  }

  function checkRow(row){
    if(!Array.isArray(row)){
      throw new Error("csvtable: rows must be an array."); }
    if(row.length == 0){
      throw new Error("csvtable: row must not be empty."); }
  }
  function getRowId(key){
    if(!table.ids.hasOwnProperty(key)){
      return -1;
    }
    return table.ids[key];
  }

  table.addRow = (row)=>{
    checkRow(row);
    let key = autoid? currentAutoId: row[0];
    if(!autoid && table.hasOwnProperty(key)){
      return false;
    }
    
    let rowid = currentAutoId++;
    table.ids[key] = rowid;

    table.rows[rowid] = row;
    return rowid;
  }
  table.setProp = (name, value)=>{
    if(name == "quoted"){
      checkType(value, 'boolean');
      quoted = value;
    }
    if(name == "autoid"){
      checkType(value, 'boolean');  
      autoid = value;
    }
    if(name == "autoparse"){
      checkType(value, 'boolean');
      autoparse = value;
    }
    if(name == "filename"){
      checkType(value, 'string');
      filename = value;
    }
  }

  table.getRow = (key)=>{
    let rowid = getRowId(key);
    if(rowid == -1) return null;
    return table.rows[rowid];
    return table.rows[key];
  }
  // id is optional, and only used if autoid is true.
  table.setRow = (row, id)=>{
    checkRow(row);
    let rowid = autoid? id : getRowId(row[0]);
    if(rowid==null || rowid == undefined || rowid < 0){
      rowid = currentAutoId++;
    }
    table.rows[rowid] = row;
  }
  table.deleteRow = (key)=>{
    let rowid = getRowId(key);
    if(rowid < 0) return false;
    if(!table.rows.hasOwnProperty(key)){
      return false;
    }
    delete table.ids[key];
    delete table.rows[rowid];
    return true;
  }
  table.save = (after)=>{
    const stream = fs.createWriteStream(folder + "/" + filename);
    if(after){
      if(typeof after != "function"){
        throw new Error("csvtable table.save(after): after must be a function.");
      }
      stream.on('finish', after);
    }
    const quotewrap = x=> '"' + x + '"'
    let headerstr = table.headers.map(quotewrap).join(",");
    if(autoid) headerstr = '"AutoId",' + headerstr
    stream.write(headerstr + "\n");
    //console.log(table);
    for(const key in table.ids){
      const rowid = table.ids[key];
      const row = table.rows[rowid];
      //console.log(key, rowid, row);
      let rowstr = row.map(quotewrap).join(",");
      if(autoid) rowstr = `"${rowid}",` + rowstr;
      stream.write(rowstr + "\n");
    }
  }
  table.load = (after)=>{
    let stream = fs.createReadStream(folder + "/" + filename);
    if(after){
      if(typeof after != "function"){
        throw new Error("csvtable table.load(after): after must be a function.");
      }
      stream.on('finish', after);
    }
    //for(let row of 
  }
  return table;

  function rowToString(row){
    for(let i=0; i<row.length; ++i){
      let entry = "" + row[i];
      if(quoted) entry = "\"" + entry.replace(/\\/g, '\\\\').replace(/\"/g, '\\"') + "\"";
    }
  }
  function parseRow(s){
    let row = [];
    let j = 0;
    let fullquote = true;
    let quotechar = null;
    for(let i=0; i<s.length; ++i){
      let c = s[i];
      // trim leading whitespace
      while(i == j && (s[i] == " " || s[i] == "\t")){
        ++i; ++j;
      }
      if(c == "\"" || c == "\'"){
        quotechar = c;
        if(i > j) fullquote = false;
        while(s[++i] != quotechar){
          if(s[i] == "\\") ++i; }
      }
      if(c == "," || i == s.length-1){
        let entry;
        // back up to trim whitespace
        while(s[i-1] == " " || s[i-1] == "\t") --i;
        if(fullquote && s[i-1] == "\""){
          let str = "";
          try{
            str = s.substring(j, i);
            entry = JSON.parse(str)
          } catch(e){
            console.warn("csvtable internal function parseRow: row entry could not be parsed with 'JSON.parse'.  Falling back on manual unescaping.", str);
            str = s.substring(j+1, i-1);
            entry = str.replace(/(?:\\([\\\"\']))/g, '$1');
          }
        } else {
          entry = s.substring(j, i); 
        }
        if(autoparse){
          if(entry == "true") entry = true;
          if(entry == "false") entry = false;
          if(entry == "null") entry = null;
          if(entry == "undefined") entry = undefined;
          if(entry.match(FloatRegex)) entry = parseFloat(entry);
          if(entry.match(BigIntRegex)) entry = BigInt(entry);
          if(entry.match(HexRegex)) entry = parseInt(entry, 16);
        }
        row.push(entry);
        fullquote = true;
        // we backed up to trim whitespace, go forward to comma again.
        while(s[i] == " " || s[i] == "\t") ++i;
      }
      if(c == "\n"){
        throw new Error("csvtable, internal function 'parseRow' encountered unexpected newline character.");
      }
    }
    return row;
  }
}

Table.HttpServer = TableHttpServer;
Table.TelnetServer = TableTelnetServer;

function TableHttpServer(options){
}
function TableTelnetServer(options){

  let tables = {};
  if(!options) options= {};

  // this is a telnet server
  // 'https://www.npmjs.com/package/telnet'
  return function(client){
    client.do.transmit_binary();
    client.do.window_size();

    client.on('window size', function (e) {
      if (e.command === 'sb') {
        //console.log('telnet window resized to %d x %d', e.width, e.height)
      }
    })
    let line = "";
    client.on('data', function (b) {
      let n = line.length;
      line += b.toString("utf-8");
      let nextline = "";
      for(let i=n; i<line.length; ++i){
        if(line[i] == "\n"){
          nextline = line.substring(i);
          line = line.substring(0, i);
          TableCommand(tables, line, s=>client.write, options);
          line = nextline;
          i = 0;
          n = nextline.length;
        }
      }
      // client.write(b);
    })
  }
}
       
function TableCommand(tables, args, line){
  let options = args['options']? args['options'] : {};
  let emit = args['emit']? args['emit'] : x => console.log(x);

  let folder = options['folder']? options['folder'] : '.';
  //console.log('folder', folder);
  let writeonce = options['writeonce']? true : false;
  let readonly = options['readonly']? true : false;

  // Note: table names are not case sensitive.
  // There are 3 types of commands, general commands, table commands, and row commands
  //
  // generalcommand ...
  //   saveall, loadall
  //
  // tablecommand tablename ...
  //   newtable, rmtable, setprop, save, load
  // 
  // rowcommand tablename rowindex ...
  //   addrow, getrow, setrow, delrow
  // 
  //
  //let command = "newtable TestTable file.csv a b c d e f g";
  //let command = "addrow TestTable  33 22 33 44 33 22 33";
  let parts = line.split(/\s+/);
  let action = parts[0];
  let tablename = parts.length > 1? parts[1] : "";
  let table = tables[tablename];

  if(action == "saveall"){
    if(readonly){
      emit("Invalid operation. Connection is readonly.");
      return;
    }
    for(const tablename in tables){
      const table = tables[tablename];
      table.save(()=> emit("All tables saved.\n"));
    }
  }
  if(action == "loadall"){
    for(let tablename of tables){
      let table = tables[tablename];
      table.load(()=> emit("All tables loaded.\n"));
    }
  }
  if(action == "newtable"){
    if(readonly){
      emit("Invalid operation. Connection is readonly.");
      return;
    }
    let filename = parts[2];
    let columns = parts.slice(3);
    if(tablename in tables){
      throw new Error(`newtable: Table ${tablename} already exists.`);
    }
    tables[tablename] = Table(columns, {filename, folder});
    emit(`New table "${tablename}" in "${filename}" : ${columns.join(' ') }`)
  }
  if(action == "rmtable"){
    if(readonly){
      emit("Invalid operation. Connection is readonly.");
      return;
    }
    let row = parts.slice(2);
    table.delRow(row);
  }
  if(action == "setprop"){
    if(readonly){
      emit("Invalid operation. Connection is readonly.");
      return;
    }
    let name = parts[2];
    let value = JSON.parse(parts[3]);
    table.setProp(name, value);
  }
  if(action == "save"){
    if(readonly){
      emit("Invalid operation. Connection is readonly.");
      return;
    }
    table.save();
  }
  if(action == "load"){
    table.load();
  }
  if(action == "addrow"){
    if(readonly){
      emit("Invalid operation. Connection is readonly.");
      return;
    }
    let row = parts.slice(2);
    //table.addRow(row);
    emit(table.addRow(row));
  }
  if(action == "getrow"){
    let key = parts[2];
    let row = table.getRow(key);
    if(row) emit(row.join(','));
    else emit(`Unknown key "${key}"`)
  }
  if(action == "setrow"){
    if(readonly){
      emit("Invalid operation. Connection is readonly.");
      return;
    }
    if(writeonce){
      emit("Invalid operation. Connection is 'writeonce'.");
      return;
    }
    let row = parts.slice(2);
    table.setRow(row);
  }
  if(action == "delrow"){
    if(readonly){
      emit("Invalid operation. Connection is readonly.");
      return;
    }
    if(writeonce){
      emit("Invalid operation. Connection is 'writeonce'.");
      return;
    }
    let row = parts.slice(2);
    table.deleteRow(row);
  }
}
function Test(){
  let tables = {};
  let args = {options: {folder: "data/csv"}};
  TableCommand(tables, args, "newtable Test Test.csv a b c");
  TableCommand(tables, args, "addrow Test 1 2 3");
  TableCommand(tables, args, "getrow Test 1");
  TableCommand(tables, args, "newtable User User.csv username email psalt phash");
  TableCommand(tables, args, 'setprop User autoid true');
  TableCommand(tables, args, 'addrow User joe joe@example.com e2k0n3 a23n3o2o');
  TableCommand(tables, args, 'addrow User bill elevatorrepairman@example.com weihfoij fwonofe');
  TableCommand(tables, args, 'getrow User 1');
  TableCommand(tables, args, 'getrow User 2');
  TableCommand(tables, args, 'save User');
  TableCommand(tables, args, 'saveall');
}

if(require.main === module){
  Test();
}
module.exports = Table;
