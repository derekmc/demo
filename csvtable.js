
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

  // TODO let savedelay = ; // the minimum time between saving
  let quoteall = options['quoteall']? true : false;
  let autoid = options['autoid']? true : false; // generate an id, instead of using first entry.
  let autoparse = options['autoparse']? true : false;
  let filename = options['filename']? options['filename'] : null;
  let folder = options['folder']? options['folder'] : '.';
  
  fs.mkdirSync(folder, {recursive: true});

  // checkType(quoteall, "boolean");
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
      throw new Error("csvtable: row must be an array."); }
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
    if(name == "quoteall"){
      checkType(value, 'boolean');
      quoteall = value;
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
    if(!filename){
      return after(false);
    }
    const stream = fs.createWriteStream(folder + "/" + filename, {encoding: 'utf8'});
    if(after){
      if(typeof after != "function"){
        throw new Error("csvtable table.save(after): after must be a function.");
      }
      stream.on('finish', ()=>after(true));
    }
    const quotewrap = x=> '"' + x + '"'
    let headerstr = table.headers.map(quoteall? quotewrap : x=>x).join(",");
    if(autoid) headerstr = (quoteall? '"AutoId",' : "AutoId,") + headerstr
    stream.write(headerstr + "\n");
    //console.log(table);
    for(const key in table.ids){
      const rowid = table.ids[key];
      const row = table.rows[rowid];
      //console.log(key, rowid, row);
      let rowstr = rowToString(row);
      if(autoid) rowstr = `${(quoteall? quotewrap : x=>x)(rowid)},` + rowstr;
      stream.write(rowstr + "\n");
    }
  }
  table.load = (after)=>{
    if(!after) after = (success)=> console.log(`Table load ${success? "succeeded" : "failed"}`);
    if(typeof after != "function"){
      throw new Error("csvtable table.load(after): after must be a function.");
    }
    if(!filename){
      return after(false);
    }
    let stream = fs.createReadStream(folder + "/" + filename, {encoding: 'utf8'});
    let line = "";
    let linenumber = 0;
    let n = line.length;

    //console.log("stream", stream);
    stream.on('readable', function(){
      let chunk;
      while((chunk = stream.read()) != null){
        readChunk(chunk);
      }
      readChunk("\n");
    })
    //stream.on('data', readChunk);  
    stream.on('finish', ()=>{ readChunk("\n"); after(true); });
    stream.on('error', (err)=>{
      console.error(`failed to load file '${folder + "/" + filename}`, err);
      after(false);
    })

    console.log(`Reading table ${folder + "/" + filename}`);
    //readChunk('hey');
    
    //readTable(stream);
    //async function readTable(tableStream){
   
    function readChunk(chunk){
      // console.log('chunk', chunk.toString());
      line += chunk; 
      let nextline = "";
      for(let i=n; i<line.length; ++i){
        if(line[i] == "\n"){
          nextline = line.substring(i+1);
          line = line.substring(0, i);
          let row = [];
          if(i > 0){
            row = parseRow(line);
            if(linenumber == 0){
              if(!headers || headers.length == 0){
                headers = row.slice(autoid? 1 : 0);
              } else {
                fileheaders = row.slice(autoid? 1 : 0);
                let match = headers.length == fileheaders.length;
                for(let i=0; match && i<headers.length; ++i){
                  if(headers[i].trim().toLowerCase() != fileheaders[i].trim().toLowerCase()){
                    match = false;
                  }
                }
                if(!match){
                  console.warn(`Table '${tablename}' expected headers do not match fileheaders.\n  ${headers}\n  ${fileheaders}`)
                }
              }
            } else {
              if(autoid){
                let id = parseInt(row[0]);
                row = row.slice(1);
                table.ids[id] = id;
                table.rows[id] = row;
                currentAutoId = Math.max(currentAutoId, id + 1);
              } else {
                if(!table.addRow(row)){
                  console.warn(`Duplicate row key: ${row[0]}, for row ${JSON.stringify(row)}.`);
                }
              }
            }
            ++linenumber;
          }
          line = nextline;
          i = 0;
          n = line.length;
        }
      }
    }
  }
  return table;

  function rowToString(row){
    let s = "";
    for(let i=0; i<row.length; ++i){
      let entry = (typeof row[i] == "bigint")? row[i] + "n" : "" + row[i];
      let special = entry.indexOf('"') >= 0 || entry.indexOf("\n") >= 0 || entry.indexOf(",") >= 0 || entry.indexOf("'") >= 0;
      if(quoteall || special){
        try{
          entry = JSON.stringify(entry);
        } catch(e){
          console.warn("csvtable internal function rowToString: row entry could not be stringified with 'JSON.stringify'.  Falling back on manual escaping.", str);
          entry = "\"" + entry.replace(/\\/g, '\\\\').replace(/\"/g, '\\"') + "\"";
        }
      }
      s += entry;
      if(i < row.length - 1) s += ",";
    }
    return s;
  }
  function parseRow(s){
    let options = {
      autoparse: autoparse,
    }
    return CSVParseRow(s, options);
  }
}

function CSVParseRow(s, options){
  // console.log("parsing line", s);
  if(!options) options = {};
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
      if(i==s.length-1){
        ++i;
      }
      let entry;
      // back up to trim whitespace
      while(s[i-1] == " " || s[i-1] == "\t") --i;
      if(fullquote && s[i-1] == "\""){
        let str = "";
        try{
          str = s.substring(j, i);
          entry = JSON.parse(str)
        } catch(e){
          console.warn("csvtable internal function 'CSVParseRow': row entry could not be parsed with 'JSON.parse'.  Falling back on manual unescaping.", str);
          str = s.substring(j+1, i-1);
          entry = str.replace(/(?:\\([\\\"\']))/g, '$1');
        }
      } else {
        entry = s.substring(j, i); 
      }
      if(options.autoparse){
        if(entry == "true") entry = true;
        else if(entry == "false") entry = false;
        else if(entry == "null") entry = null;
        else if(entry == "undefined") entry = undefined;
        else if(entry.match(FloatRegex)) entry = parseFloat(entry);
        else if(entry.match(BigIntRegex)) entry = BigInt(entry);
        else if(entry.match(HexRegex)) entry = parseInt(entry, 16);
      }
      row.push(entry);
      fullquote = true;
      // we backed up to trim whitespace, go forward to comma again.
      while(i<s.length && (s[i] == " " || s[i] == "\t")) ++i;
      j = i+1;
    }
    if(c == "\n"){
      throw new Error("csvtable, internal function 'CSVParseRow' encountered unexpected newline character.");
    }
  }
  // console.log("parsed row", row);
  return row;
}


function TableLoad(tablename, folder){
  if(!folder) folder = "./";
  let filename = tablename.toLowerCase() + ".csv";
  let options = {filename: filename, folder: folder, autoload: true};
  let table = Table([], options);
  table.load();
  return table;
}


function HttpServer(options){
}
function TelnetServer(options){

  let tables = {};
  if(!options) options= {};
  let port = 8081;
  if(options['port']) port = options['port'];

  // this is a telnet server
  // 'https://www.npmjs.com/package/telnet
  telnet.createServer(function(client){
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
          TableCommand(tables, {options: options}, line);
          line = nextline;
          i = 0;
          n = nextline.length;
        }
      }
      // client.write(b);
    })
  }).listen(port);
  console.log(`CSVTable: telnet server listening on port ${port}`);
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
  //let command = "newtable TestTable file.csv a, b, c, d, e, f, g";
  //let command = "addrow TestTable  33 22 33 44 33 22 33";
  let parts = line.split(/\s+/);
  let action = parts[0];
  let tablename = parts.length > 1? parts[1] : "";
  let table = tables[tablename];
  let filename = tablename.toLowerCase() + ".csv";

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
    let filenames = {};
    // if there's a conflict in memory table and filesystem table,
    // in memory takes precedent;

    for(const tablename in tables){
      filenames[tablename] = tablename;
      let table = tables[tablename];
      table.load(()=> emit(`'${tablename}' loaded.`));
    }
    fs.readdir(folder, (err, files) => {
      files.forEach(file => {
        let match = file.match(/^(.*)\.csv$/);
        if(match){
          let name = match[1].toLowerCase();
          if(name in tables){
            return;
          }
          let table = TableLoad(name, folder);
          tables[name] = table;
        }
      });
    });
  }
  if(action == "newtable"){
    if(readonly){
      emit("Invalid operation. Connection is readonly.");
      return;
    }
    let filename = parts[1] + ".csv";
    let rest = CSVParseRow(parts.slice(3).join(" "), {autoparse: true});
    let columns = rest;
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
    if(table) table.save();
    else emit(`No such table '${tablename}'`);
  }
  if(action == "load"){
    if(table) table.load();
    else emit(`No such table '${tablename}'`);
  }
  if(action == "addrow"){
    if(readonly){
      emit("Invalid operation. Connection is readonly.");
      return;
    }
    let row = CSVParseRow(parts.slice(2).join(" "), {autoparse: true});
    emit(table.addRow(row));
  }
  if(action == "getrow"){
    let key = parts[2];
    let row = table.getRow(key);
    if(row) emit(row.join(','));
    else emit(`Unknown key "${key}"`);
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
    let row = CSVParseRow(parts.slice(2).join(" "), {autoparse: true});
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
  let args = {options: {folder: "data/csv", emit: x => console.log(x)}};
  TableCommand(tables, args, "loadall");
  setTimeout(()=>console.log('tables', tables), 300);
  return;
  TableCommand(tables, args, "newtable test a, b, c");
  TableCommand(tables, args, "newtable user username, email, psalt, phash");
  TableCommand(tables, args, 'setprop user autoid true');
  TableCommand(tables, args, 'load User');
  setTimeout(()=>{
    //console.log(tables);
    //console.log(tables.User.rows);
    TableCommand(tables, args, "addrow test 1,2,3");
    TableCommand(tables, args, "addrow test hello, world!!!");
    TableCommand(tables, args, "getrow test 1");
    TableCommand(tables, args, 'addrow user joe, joe@example.com, e2k0n3, a23n3o2o');
    TableCommand(tables, args, 'addrow user bill, elevatorrepairman@example.com, weihfoij, fwonofe');
    TableCommand(tables, args, 'getrow user 1');
    TableCommand(tables, args, 'getrow user 2');
    TableCommand(tables, args, 'save user');
    TableCommand(tables, args, 'saveall');
  }, 3000)
  console.log('waiting...');
}
if(require.main === module){
  //Test();
  TelnetServer();
}
Table.TableLoad = TableLoad;
Table.TableCommand = TableCommand;
Table.HttpServer = HttpServer;
Table.TelnetServer = TelnetServer;
Table.Test = Test;
module.exports = Table;
