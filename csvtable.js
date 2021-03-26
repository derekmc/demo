
//const csv = require('csv');
const fs = require('fs');

function Table(filename, headers){
  let table = {
    headers: headers,
    rows: {},
  };
  table.addRow = (row)=>{
    //check if row exists.
    let key = row[0];
    if(table.hasOwnProperty(key)){
    }
  }
  table.getRow = (key)=>{
    if(!table.rows.hasOwnProperty(key)){
      return null;
    }
    return table.rows[key];
  }
  table.setRow = (row)=>{
  }
  table.deleteRow = (key)=>{
  }
  table.setFile = (f)=>{
    filename = f;
  }
  table.save = ()=>{
  }
  table.load = ()=>{
  }
}

function TableServer(folder){
  if(folder === undefined){
    folder = ".";
  }
  let tables = {};
  return function(req, res){
    //let command = "newtable TestTable file.csv a b c d e f g";
    let command = "addrow TestTable  33 22 33 44 33 22 33";
    let parts = command.split(/\s+/);
    let action = parts[0];
    let tablename = parts[1];
    let table = tables[tablename];
    if(action == "newtable"){
      let filename = parts[2];
      let columns = parts.slice(3);
      if(tablename in tables){
        throw new Error(`newtable: Table ${tablename} already exists.`);
      }
      tables[tablename] = Table(filename, columns);
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
    if(action == "rmtable"){
      let row = parts.slice(2);
      table.delRow(row);
    }
    if(action == "save"){
      let row = parts.slice(2);
      table.delRow(row);
    }
    if(action == "load"){
      let row = parts.slice(2);
      table.delRow(row);
    }
  }
}

exports.Table = Table;
