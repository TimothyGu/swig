var fs      = require("fs");
var util    = require("util");
var path    = require("path");
var crypto  = require("crypto");
var tags    = require("./tags");
var parser  = require("./parser");

var CACHE   = {};
var DEBUG   = false;
var ROOT    = "/";

// Call this before using the templates
exports.init = function(root, debug){
  DEBUG = debug
  ROOT = root;
}

function createTemplate( data, id ){
  var tokens;
  var template = {
    // Allows us to include templates from the compiled code
    fromFile: fromFile,
    // These are the blocks inside the template
    blocks: {},
    // Distinguish from other tokens
    type: parser.TEMPLATE,
    // Allows us to print debug info from the compiled code
    util: util,
    // The template ID (path relative to tempalte dir)
    id: id
  };

  // The template token tree before compiled into javascript
  template.tokens = parser.parse.call( template, data, tags );
  
  // The raw template code - can be inserted into other templates
  // We don't need this in production
  var code = parser.compile.call( template );

  if( DEBUG ) {
    template.code = code;
  }
  
  // The compiled render function - this is all we need
  template.render = new Function("__context", "__parents",
   [  '__parents = __parents ? __parents.slice() : [];'
      // Prevents circular includes (which will crash node without warning)
    , 'for(var i=0, j=__parents.length; i<j; ++i){'
    , '   if( __parents[i] === this.id ){'
    , '     return "Circular import of template " + this.id + " in " + __parents[__parents.length-1];'
    , '   }'
    , '}'
      // Add this template as a parent to all includes in its scope
    , '__parents.push( this.id );'
    , 'var __output = [];'
    , 'var __this = this;' 
    , code
    , 'return __output.join("");'].join("\n")
  );

  return template;
}

/**
 * Returns a template object from the given filepath.
 * The filepath needs to be relative to the template directory.
 */
function fromFile( filepath ){
  
  if( filepath[0] == '/' ){
    filepath = filepath.substr(1);
  }
  if( filepath in CACHE && !DEBUG ){
    return CACHE[filepath];
  }

  var data = fs.readFileSync( ROOT + "/" + filepath, 'utf8' );
  // TODO: see what error readFileSync returns and warn about it
  if( data ) {
    return CACHE[filepath] = createTemplate(data, filepath);
  }
}

/**
 * Returns a template object from the given string.
 */
function fromString( string ){
  var hash = crypto.createHash('md5')
  
  hash.update(string);
  hash = hash.digest('hex');
  
  if( hash in CACHE && !DEBUG ) {
    return CACHE[hash];
  }
  return CACHE[hash] = createTemplate(string, hash);
}

exports.fromFile = fromFile;
exports.fromString = fromString;