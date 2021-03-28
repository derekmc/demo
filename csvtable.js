
//const csv = require('csv');
const fs = require('fs');
const telnet = require('telnet');

// If autoid is on, the table is indexed, by an automatically generated id.
// Otherwise, A table is indexed by the first column.
// For a given database, it is recommended not to switch between autoid and manual id.

function Table(headers, props){

  if(!props) props = {};
  if(!headers) headers = [];
  let ids = {};

  checkType(headers, "array");
  checkType(props, "object");

  let quoted = props['quoted']? true : false;
  let autoid = props['autoid']? true : false; // generate an id, instead of using first entry.
  let autoparse = props['autoparse']? true : false;
  let filename = props['filename']? props['filename'] : null;

  // checkType(quoted, "boolean");
  // checkType(autoid, "boolean");
  // checkType(autoparse, "boolean");
  if(filename) checkType(filename, "string");

  // store autoids for live table no matter what,
  // the autoid prop, just determines whether that is saved.
  let currentAutoId = 0;

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
      if(!autoid && value){
        table.headers.splice(0, 0, "AutoId");
      }
      if(autoid && !value){
        let removed = table.headers.shift();
        if(removed != "AutoId"){
          throw new Error("csvtable table.setProp: first header column was unexpectedly not 'AutoId'")
        }
      }
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
      throw new Error("unknown row");
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
      if(i == j && c == " "){
        ++j;
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
        while(s[i-1]== " " || s[i-1] == "\t") --i;
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
  table.save = (after)=>{
    let stream = fs.createWriteStream(filename);
    if(after){
      if(typeof after != "function"){
        throw new Error("csvtable table.save(after): after must be a function.");
      }
      stream.on('finish', after);
    }
    for(let key of table.rows){
      let row = table.rows[key];
    }
  }
  table.load = (after)=>{
    let stream = fs.createReadStream(filename);
    if(after){
      if(typeof after != "function"){
        throw new Error("csvtable table.load(after): after must be a function.");
      }
      stream.on('finish', after);
    }
    //for(let row of 
  }
}

function TableServer(folder){
  if(folder === undefined){
    folder = ".";
  }

  let tables = {};

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
          TableCommand(line);
          line = nextline;
          i = 0;
          n = nextline.length;
        }
      }
      // client.write(b);
    })
       
    function TableCommand(line){
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
      let parts = command.split(/\s+/);
      let action = parts[0];
      let tablename = parts.length > 1? parts[1] : "";
      let table = tables[tablename];

      if(action == "saveall"){
        for(let tablename of tables){
          let table = tables[tablename];
          table.save(()=> client.write("All tables saved.\n"));
        }
      }
      if(action == "loadall"){
        for(let tablename of tables){
          let table = tables[tablename];
          table.load(()=> client.write("All tables loaded.\n"));
        }
      }
      if(action == "newtable"){
        let filename = parts[2];
        let columns = parts.slice(3);
        if(tablename in tables){
          throw new Error(`newtable: Table ${tablename} already exists.`);
        }
        tables[tablename] = Table(filename, columns);
      }
      if(action == "rmtable"){
        let row = parts.slice(2);
        table.delRow(row);
      }
      if(action == "setprop"){
      }
      if(action == "save"){
        let row = parts.slice(2);
        table.delRow(row);
      }
      if(action == "load"){
        let row = parts.slice(2);
        table.delRow(row);
      }
      if(action == "addrow"){
        let row = parts.slice(2);
        table.addRow(row);
      }
      if(action == "getrow"){
        let key = parts[2];
        table.getRow(key);
      }
      if(action == "setrow"){
        let row = parts.slice(2);
        table.setRow(row);
      }
      if(action == "delrow"){
        let row = parts.slice(2);
        table.delRow(row);
      }
    }
  }
}


module.exports = Table;
