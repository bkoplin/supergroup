import {
  assignIn,
  clone as clone_,
  cloneDeep,
  each,
  every,
  groupBy,
  has,
  isArray,
  isNaN,
  keys,
  map,
  tail,
  toPairs,
} from 'lodash'
import {
  State,
} from './State'

let childProp = 'children'

/* @exported function supergroup.group(recs, dim, opts)
     * @param {Object[]} recs list of records to be grouped
     * @param {string or Function} dim either the property name to
        group by or a function returning a group by string or number
     * @param {Object} [opts]
     * @param {String} opts.childProp='children' If group ends up being
        * hierarchical, this will be the property name of any children
     * @param {String[]} [opts.excludeValues] to exlude specific group values
     * @param {function} [opts.preListRecsHook] run recs through this
        * function before continuing processing
     * @param {function} [opts.dimName] defaults to the value of `dim`.
        * If `dim` is a function, the dimName will be ugly.
     * @param {function} [opts.truncateBranchOnEmptyVal]
     * @param {boolean} [opts.multiValuedGroup=false]
     * @param {boolean} [opts.preventScalarInMultiValuedGroup=false] // setting globally
     * @return {Array of Values} enhanced with all the List methods
     *
     * Avaailable as _.supergroup, Underscore mixin
     */
const supergroup = function (recs, dim, opts) {
  // if dim is an array, use multiDimList to create hierarchical grouping

  // commented out stuff here from vocab-pop version, never did whatever I was trying
  // wanted to keep opts clean, but it breaks the parent ref
  // opts = cloneDeep(opts || {})
  opts = opts || {}

  // if (opts.allowCloning) {
  recs = recs.map((rec, i) => {
    const clone = clone_(rec)
    clone._recIdx = i
    return clone
  })
  // }
  if (isArray(dim))
    return multiDimList(recs, dim, opts)
  recs = opts.preListRecsHook ? opts.preListRecsHook(recs) : recs
  childProp = opts.childProp || childProp

  if (opts.truncateBranchOnEmptyVal)
    recs = filterOutEmpty(recs, dim)
  let groups = groupBy(recs, dim) // use Underscore's groupBy: http://underscorejs.org/#groupBy
  if (opts.excludeValues) { // why isn't truncateBranchOnEmptyVal treated as an excludeValue?
    each(opts.excludeValues, (d) => {
      delete groups[d]
    })
  }
  const isNumeric = has(opts, 'isNumeric')
    ? opts.isNumeric
    : wholeListNumeric(groups) // does every group Value look like a number or a missing value?
  groups = map(toPairs(groups), (pair, _i) => { // setup Values for each group in List
    const rawVal = pair[0]
    let val
    if (isNumeric) {
      val = makeNumberValue(rawVal) // either everything's a Number
    }
    else {
      val = makeStringValue(rawVal) // or everything's a String
    }
    /* The original records in this group are stored as an Array in
         * the records property (should probably be a getter method).
         */
    val.records = pair[1]
    /* val.records is enhanced with Underscore methods for
         * convenience, but also with the supergroup method that's
         * been mixed in to Underscore. So you can group this specific
         * subset like: val.records.supergroup
         * on        FIX!!!!!! (2023-04-28 what was that about?)
         */

    // 2023-04-28: should records really have all the supergroup methods?
    addSupergroupMethods(val.records)

    val.dim = (opts.dimName) ? opts.dimName : dim
    val.records.parentVal = val // NOT TESTED, NOT USED, PROBABLY WRONG
    if (opts.parent)
      val.parent = opts.parent
    if (val.parent) {
      if ('depth' in val.parent) {
        val.depth = val.parent.depth + 1
      }
      else {
        val.parent.depth = 0
        val.depth = 1
      }
    }
    else {
      val.depth = 0
    }
    return val
  })
  // groups = makeList(groups); // turns groups into a List object
  groups = addListMethods(groups) // turns groups into a List object
  groups.records = recs // NOT TESTED, NOT USED, PROBABLY WRONG
  groups.dim = (opts.dimName) ? opts.dimName : dim
  groups.isNumeric = isNumeric

  each(groups, (group, _i) => {
    group.parentList = groups
    // group.idxInParentList = i; // maybe a good idea, but don't need it yet
  })
  // pointless without recursion
  // if (opts.postListListHook) groups = opts.postListListHook(groups);

  // next line deleted from vocab-pop version, not sure why
  groups._optsAtThisLevel = opts

  return groups
}

// nested groups, each dim is a level in hierarchy
function multiDimList(recs, dims, opts) {
  opts.wasMultiDim = true // pretty kludgy
  const groups = supergroup(recs, dims[0], opts)
  const allDimsButFirst = tail(dims)
  each(allDimsButFirst, (dim) => {
    groups.addLevel(dim, opts)
  })
  return groups
}

function wholeListNumeric(groups) {
  const isNumeric = every(keys(groups), (k) => {
    return k === null
      || k === undefined
      || (!isNaN(Number(k)))
      || ['null', '.', 'undefined'].includes(k.toLowerCase())
  })
  if (isNumeric) {
    each(keys(groups), (k) => {
      if (isNaN(k)) {
        delete groups[k] // getting rid of NULL values in dim list!!
      }
    })
  }
  return isNumeric
}
// @class List
// @description Native Array of groups with various added methods and properties.
// Methods described below.
function List() {
}

List.prototype.state = function () {
  return new State(this)
}
List.prototype.isSupergroupList = true
// sometimes a root value is needed as the top of a hierarchy
List.prototype.asRootVal = function (name, dimName) {
  const val = makeValue(name || 'Root')
  val.dim = dimName || 'root'
  val.depth = 0
  val.records = this.records
  val.setChildren(this)
  each(val.getChildren(), (d) => {
    d.parent = val
  })
  each(val.descendants(), (d) => {
    d.depth = d.depth + 1
  })
  return val
}
List.prototype.leafNodes = function (level) { // level isn't passed along. probably broken
  return _.chain(this).invokeMap('leafNodes').flatten()
.addSupergroupMethods()
.value()
}
/* not working yet...
    List.prototype.clone = function() {
      var parentVal = this.parentVal,
      return _.chain(this).invokeMap('clone')
                    .tap(addListMethods)
                    .value();
    };
    */
List.prototype.rawValues = function () {
  return _.chain(this).map((d) => {
    return d.valueOf()
  }).value()
}
// lookup a value in a list, or, if query is an array
//      it is interpreted as a path down the group hierarchy
List.prototype.lookup = function (query) {
  if (_.isArray(query)) {
    // if group has children, can search down the tree
    const values = query.slice(0)
    let list = this
    let ret
    while (values.length) {
      ret = list.singleLookup(values.shift())
      list = ret.getChildren()
    }
    return ret
  }
  else {
    return this.singleLookup(query)
  }
}

List.prototype.getLookupMap = function () {
  const self = this
  if (!('lookupMap' in self)) {
    self.lookupMap = {}
    self.forEach((d) => {
      if (d in self.lookupMap) {
        console.warn(`multiple occurrence of ${d
        } in list. Lookup will only get the last`)
      }
      self.lookupMap[d] = d
    })
  }
  return self.lookupMap
}
List.prototype.singleLookup = function (query) {
  return this.getLookupMap()[query]
}

// lookup more than one thing at a time
List.prototype.lookupMany = function (query) {
  const list = this
  return addSupergroupMethods(_.chain(query).map((d) => {
    return list.singleLookup(d)
  })
    .compact()
    .value())
}
List.prototype.flattenTree = function () {
  return _.chain(this)
    .map((d) => {
      const desc = (d.descendants && d.descendants() || [])
      return [d].concat(desc)
    })
    .flatten()
    .filter(_.identity) // expunge nulls
    .tap(addListMethods)
    .value()
}
List.prototype.nodesAtLevel = function (level, currentLevel = 0) {
  if (level === currentLevel)
    return this
  this.forEach((d) => {
    if (!d.hasChildren())
      throw new Error('asking for deeper level than exists')
  })
  return addListMethods(_.flatten(
    this.map(d => d.getChildren().nodesAtLevel(level, currentLevel + 1)),
  ))
}
List.prototype.addLevel = function (dim, opts) {
  each(this, (val) => {
    val.addLevel(dim, opts)
  })
  return this
}

// VERY QUESTIONABLE STUFF FROM vocab-pop, NEED TO REVIEW IF NEEDED OR BROKEN
// if (opts.allowCloning) {
List.prototype.addLevelPure = function (dim, opts) {
  // breaks prototype two levels up!!!!!!!!!!!!! no time to fix
  const clone = this.clone()
  // if (clone[0] && clone[0].children) debugger
  each(clone, (val) => {
    // val.addLevelPure(dim, opts);
    val.addLevel(dim, opts)
  })
  return clone
}
List.prototype.clone = function () {
  const clone = Object.assign([], this)
  clone.records = cloneDeep(this.records)
  addSupergroupMethods(clone)
  const list = this
  clone.splice(0, clone.length, ...clone.map(
    (val) => {
      const newVal = makeValue(val)
      assignIn(newVal, cloneDeep(val))
      newVal.records = val.records.map(rec => clone.records[rec._recIdx])
      newVal.parentList = clone
      // if (val.children) debugger
      // WRONG RECORDS!!!!
      if (val.hasChildren()) {
        newVal[childProp] = val.getChildren().clone()
      }
      return newVal
    },
  ))
  return clone
}

// }
List.prototype.namePaths = function (opts) {
  return map(this, (d) => {
    return d.namePath(opts)
  })
}
List.prototype.namePathsPlus = function (opts) {
  return map(this, (d) => {
    return d.namePathPlus(opts)
  })
}
// apply a function to the records of each group
List.prototype.aggregates = function (func, field, ret) {
  const results = map(this, (val) => {
    return val.aggregate(func, field)
  })
  if (ret === 'dict')
    return _.zipObject(this, results)
  return results
}

List.prototype.d3NestEntries = function () {
  return map(this, (val) => {
    if (childProp in val) {
      return {
        key: val.toString(),
        values: addSupergroupMethods(val.getChildren()).d3NestEntries(),
      }
    }
    return {
      key: val.toString(),
      values: val.records,
    }
  })
}
List.prototype.d3NestMap = function () {
  return _.chain(this).map(
    (val) => {
      if (val.children)
        return [`${val}`, val.children.d3NestMap()]
      return [`${val}`, val.records.slice(0)]
    },
  )
.fromPairs().value()
}
List.prototype._sort = Array.prototype.sort
List.prototype.sort = function (func) {
  return addListMethods(this._sort(func))
}
List.prototype.sortBy = function (func) {
  return addListMethods(_.sortBy(this, func))
}
List.prototype.rootList = function (func) {
  if ('parentVal' in this)
    return this.parentVal.rootList()
  return this
}

// MORE STUFF ADDED FROM vocab-pop, NEEDS REVIEW
// 2023-04-28: can't find usage of this method in vocab-pop or anywhere else in my github repos
List.prototype.collapseOnlyChildren = function () {
  // if Value (item) in list has only one child, replace it with that child
  this.forEach((val) => {
    if (val.hasChildren() && val.getChildren().length === 1) {
      const child = val.getChildren()[0]
      if (child.hasChildren()) {
        val[childProp] = child[childProp]
        // reduce depths?
      }
      val[child.dim] = child
      delete val[childProp]
    }
    if (val.hasChildren()) {
      // recurse, but what if a child collapsed above also has only one child? it probably won't get collapsed
      val.getChildren().collapseOnlyChildren()
    }
  })
}
/*
     * something broke when I added func option...will fix later
    List.prototype.summary = function(opts={}) {
      let {depth=0, funcs={}} = opts
      let out = []
      //let indent = '    '.repeat(depth)
      let indent = ''
      let dim = `${this.dim}`
      let vals = `${this.length} vals`
      let recs = `${this.records.length} recs`
      out.push(`${indent}${dim}, ${recs} (${depth}) ${vals}:`)
      out.push(this.map(val=>val.summary({...opts,depth:depth+1})).join('\n'))
      return out.join('\n')
    }
    Value.prototype.hasSiblings = function() {
      return this.parentList.length > 1
    }
    Value.prototype.summary = function(opts={}) {
      let {depth=0, funcs={}} = opts
      let out = []
      let indent = '    '.repeat(depth)
      let recs = `${this.records.length} recs`
      if (depth === 0) {
        let dimPath = this.dimPath()
        let namePath = this.namePath()
        let valDepth = `lvl ${this.depth}`
        let sibs = this.hasSiblings() ? `, ${this.parentList.length - 1} siblings` : ''
        out.push(`${indent}${valDepth} ${namePath}(${dimPath}), ${recs}${sibs}`)
      } else {
        out.push(`${indent}${this}, ${recs}`)
      }
      if (funcs) {
        each(funcs, (f,k) => {
          out.push(`${indent}  ${k}: ${f(this)}`)
        })
        out.push('')
      }
      let summary = out.join('\n')
      if (this.hasChildren()) {
        //summary += (' has: ' + this.getChildren().summary(opts))
        out.push(`${indent}has:\n` + this.getChildren().summary(opts))
      }
      return summary
    }
    */
List.prototype.log = function () {
  const o = this.flattenTree().map(d => d.namePath())
.join('\n')
  return o
}
List.prototype.summary = function (depth = 0) {
  const out = []
  // let indent = '    '.repeat(depth)
  const indent = ''
  const dim = `${this.dim}`
  const vals = `${this.length} vals`
  const recs = `${this.records.length} recs`
  out.push(`${indent}${dim}, ${recs} (${depth}) ${vals}:`)
  out.push(this.map(val => val.summary(depth + 1)).join('\n'))
  return out.join('\n')
}

// @class Value
// @description Supergroup Lists are composed of Values which are
// String or Number objects representing group values.
// Methods described below.
function Value() {
}
Value.prototype.hasSiblings = function () {
  return this.parentList && this.parentList.length > 1
}
Value.prototype.summary = function (depth = 0) {
  const out = []
  const indent = '    '.repeat(depth)
  const recs = `${this.records.length} recs`
  if (depth === 0) {
    const dimPath = this.dimPath()
    const namePath = this.namePath()
    const valDepth = `lvl ${this.depth}`
    const sibs = this.hasSiblings() ? `, ${this.parentList.length - 1} siblings` : ''
    out.push(`${indent}${valDepth} ${namePath}(${dimPath}), ${recs}${sibs}`)
  }
  else {
    out.push(`${indent}${this}, ${recs}`)
  }
  let summary = out.join('\n')
  if (this.hasChildren()) {
    summary += (` has: ${this.getChildren().summary(depth)}`)
  }
  return summary
}

Value.prototype.addLevel = function (dim, opts) {
  opts = opts || {}
  each(this.leafNodes() || [this], (d) => {
    opts.parent = d
    if (!('in' in d)) { // d.in means it's part of a diffList
      d.setChildren(supergroup(d.records, dim, opts))
    }
    else { // allows adding levels to diffLists. haven't used for a long time
      if (d.in === 'both') {
        d.setChildren(diffList(d.from, d.to, dim, opts))
      }
      else {
        d.setChildren(supergroup(d.records, dim, opts))
        each(d.getChildren(), (c) => {
          c.in = d.in
          c[d.in] = d[d.in]
        })
      }
    }
    d.getChildren().parentVal = d
  })
}
Value.prototype.extendGroupBy = Value.prototype.addLevel
/* goal here is to make version of addLevel that doesn't
     * modify existing list/vals at all. but it's hard to
     * make a decent clone... gotta do this. */
// DOESN'T EXIST IN vocab-pop, LEAVING HERE BUT NEEDS REVIEW
/*
    Value.prototype.concatLevel = function(dim, opts) {
        opts = opts || {};
        each(this.leafNodes() || [this], function(d) {
            opts.parent = d;
            if ('in' in d) {
              throw new Error("not handling diffLists in concatLevel");
            }
                d.setChildren(supergroup(d.records, dim, opts));

            d.getChildren().parentVal = d;
        });
    };
    */
Value.prototype.leafNodes = function (level) {
  // until commit 31278a35b91a8f4bd4ddc4376c840fb14d2723f9
  // supported level param, to only go down so many levels
  // not supporting that any more. wasn't using it

  // if (!(childProp in this && this.getChildren().length)) return [this];
  if (!this.hasChildren())
    return [this]

  return _.chain(this.descendants()).filter(
    (d) => {
      return _.isEmpty(d.children)
    },
  )
.addSupergroupMethods().value()

  let ret = [this]
  if (typeof level === 'undefined') {
    level = Infinity
  }
  if (level !== 0 && this.getChildren() && this.getChildren().length && (!level || this.depth < level)) {
    ret = _.flatten(map(this.getChildren(), (c) => {
      return c.leafNodes(level)
    }), true)
  }
  // return makeList(ret);
  return addListMethods(ret)
}
Value.prototype.getChildren = function (emptyListOk = false) {
  if (emptyListOk)
  // ADDED '|| []' FROM vocab-pop
    return childProp in this && this[childProp] || []
  return childProp in this && this[childProp].length && this[childProp]
}
Value.prototype.setChildren = function (sg, clobber = false, returnThis = false) {
  if (this.hasChildren() && !clobber) // clobbers empty children lists regardless of clobber setting
    throw new Error('can\'t setChildren on value that already has children')
  this[childProp] = sg // assume sg is appropriate child list
  if (returnThis)
    return this
  return this[childProp]
}
Value.prototype.hasChildren = function (emptyListOk = false) {
  return !!this.getChildren(emptyListOk)
}
Value.prototype.addRecordsAsChildrenToLeafNodes = function (truncateEmpty) {
  // this method is to help with d3 layouts that expect the leaf level
  // to be an array of raw records
  function fixLeaf(node) {
    node.children = node.records
    each(node.children, (rec) => {
      rec.parent = node
      rec.depth = node.depth + 1
      for (const method in Value.prototype) {
        Object.defineProperty(rec, method, {
          value: Value.prototype[method],
        })
      }
    })
  }

  if (typeof truncateEmpty === 'undefined')
    truncateEmpty = true
  if (truncateEmpty) {
    const self = this
    self.descendants().forEach((node) => {
      if (self.parent && self.parent.children.length === 1) {
        fixLeaf(node)
      }
    })
  }
  else {
    each(this.leafNodes(), (node) => {
      fixLeaf(node)
    })
  }
  return this
}

Value.prototype.dimPath = function (opts?: string | {
  delim?: string
  dimName?: boolean
  asArray?: boolean
  noRoot?: boolean
  backwards?: boolean
  notThis?: boolean
} = {
  delim: '/',
  dimName: true,
}) {
  if (typeof opts === 'string') {
    return this.namePath({
      delim: opts,
      dimName: true,
    })
  }
  return this.namePath(opts)
}
Value.prototype.namePath = function (opts?: string | {
  delim?: string
  dimName?: boolean
  asArray?: boolean
  noRoot?: boolean
  backwards?: boolean
  notThis?: boolean
} = {
  delim: '/',
}) {
  let newOpts: Exclude<typeof opts, string>
  if (typeof opts === 'string') {
    newOpts = {
      delim: opts,
    }
  }
  else {
    newOpts = clone_(opts)
  }
  let path = this.pedigree(newOpts)
  if (newOpts.dimName)
    path = map(path, 'dim')
  if (newOpts.asArray)
    return path
  return path.join(newOpts.delim)
  /*
      var delim = opts.delim || '/';
      return (this.parent ?
              this.parent.namePath(assignIn({},opts,{notLeaf:true})) : '') +
          ((opts.noRoot && this.depth===0) ? '' :
              (this + (opts.notLeaf ? delim : ''))
           )
      */
}
// 2023-04-28 the following line should be aliasing pedigree, not clone, right? fixing it and hoping it wasn't intentional
// Value.prototype.path =  // better than 'pedigree', right?
// FROM vocab-pop
Value.prototype.clone = function () {
  // just throwing together quick...need to look at later
  const newVal = makeValue(this)
  assignIn(newVal, cloneDeep(this))
  if (this.hasChildren()) {
    newVal[childProp] = this.getChildren().clone()
  }
  return newVal
}

// better than 'pedigree', right?
Value.prototype.pedigree = function (opts?: {
  delim?: string
  dimName?: boolean
  asArray?: boolean
  noRoot?: boolean
  backwards?: boolean
  notThis?: boolean
}) {
  opts = opts || {}
  const path = []
  if (!opts.notThis)
    path.push(this)
  let ptr = this
  while ((ptr = ptr.parent)) {
    path.unshift(ptr)
  }
  if (opts.noRoot)
    path.shift()
  if (opts.backwards || this.backwards)
    path.reverse() // kludgy?

  // FROM vocab-pop
  // path = path.map(val=>val.clone())
  // path = path.map(val=>makeValue(val))
  addSupergroupMethods(path)
  return path
  /*   commented out in vocab-pop, doing same here
          // CHANGING -- HOPE THIS DOESN'T BREAK STUFF (pedigree isn't
          // documented yet)
          if (!opts.asValues) return _.chain(path).invokeMap('valueOf').value();
          return path;
          */
}
Value.prototype.path = Value.prototype.pedigree
Value.prototype.descendants = function (opts) {
  // these two lines fix a treelike bug, hope they don't do harm
  if (!this.hasChildren())
    this.setChildren(addSupergroupMethods([]))

  return this.getChildren() ? this.getChildren().flattenTree() : undefined
}
Value.prototype.lookup = function (query) {
  // if query matches this value, return this
  if (_.isArray(query)) {
    if (this.valueOf() == query[0]) { // allow string/num comparison to succeed?
      query = query.slice(1)
      if (query.length === 0)
        return this
    }
  }
  else if (_.isString(query)) {
    if (this.valueOf() == query) {
      return this
    }
  }
  else {
    throw new TypeError(`invalid param: ${query}`)
  }
  if (!this.hasChildren())
    throw new Error('can only call lookup on Values with kids')
  return this.getChildren().lookup(query)
}
Value.prototype.pct = function () {
  return this.records.length / this.parentList.records.length
}
Value.prototype.previous = function () {
  if (this.parentList) {
    // could store pos on each value, but not doing that now
    const pos = this.parentList.indexOf(this)
    if (pos > 0) {
      return this.parentList[pos - 1]
    }
  }
}
Value.prototype.aggregate = function (func, field) {
  if (_.isFunction(field))
    return func(map(this.records, field))
  return func(map(this.records, field))
}
Value.prototype.rootList = function () {
  return this.parentList.rootList()
}
Value.prototype.fixDepth = function (newDepth) {
  const incr = newDepth - this.depth
  this.depth = newDepth
  for (const d of this.descendants()) {
    d.depth += incr
  }
}
/* not working yet
    Value.clone() {
      var holdChildren = this.getChildren(),
          parent = this.parent,
          parentList = this.parentList,
    }
    */
Value.prototype.namePathPlus = function () {
  return `${this.namePath()}:[${this.descendants() ?? ''}]`
}
Value.prototype.giveChildrenTo = function (newParent) {
  const children = this.children.clone()
  children.parentVal = newParent
  children.forEach((c) => {
    c.parent = newParent
    newParent.children.push(c)
    c.parentList = newParent.children
    c.fixDepth(newParent.depth + 1)
  })
}
Value.prototype.fixDepth = function (depth) {
  if (this.depth === depth) {
    throw new Error(`Value ${this} is already at depth ${depth}`)
  }
  const incr = depth - this.depth;
  (this.descendants() ?? []).forEach(d => d.depth += incr)
}

function makeValue(v_arg) {
  if (isNaN(v_arg)) {
    return makeStringValue(v_arg)
  }
  else {
    return makeNumberValue(v_arg)
  }
}

function StringValue() {
}

// StringValue.prototype = new String;
function makeStringValue(s_arg) {
  const S = String(s_arg)
  // S.__proto__ = StringValue.prototype; // won't work in IE10
  for (const method in StringValue.prototype) {
    Object.defineProperty(S, method, {
      value: StringValue.prototype[method],
    })
  }
  return S
}

function NumberValue() {
}

// NumberValue.prototype = new Number;
function makeNumberValue(n_arg) {
  const N = Number(n_arg)
  // N.__proto__ = NumberValue.prototype;
  for (const method in NumberValue.prototype) {
    Object.defineProperty(N, method, {
      value: NumberValue.prototype[method],
    })
  }
  return N
}
assignIn(StringValue.prototype, Value.prototype)
assignIn(NumberValue.prototype, Value.prototype)

/**
 * Summarize records by a dimension
 *
 * @param {list} Records to be summarized
 * @param {numericDim} Dimension to summarize by
 *
 * @memberof supergroup
 */
const aggregate = function (list, numericDim) {
  if (numericDim) {
    list = map(list, numericDim)
  }
  return _.reduce(list, (memo, num) => {
    memo.sum += num
    memo.cnt++
    memo.avg = memo.sum / memo.cnt
    memo.max = Math.max(memo.max, num)
    return memo
  }, {
    sum: 0,
    cnt: 0,
    max: -Infinity,
  })
}
/**
 * Compare groups across two similar root nodes
 *
 * @param {from} ...
 * @param {to} ...
 * @param {dim} ...
 * @param {opts} ...
 *
 * used by treelike and some earlier code
 *
 * @memberof supergroup
 */
const diffList = function (from, to, dim, opts) {
  const fromList = supergroup(from.records, dim, opts)
  const toList = supergroup(to.records, dim, opts)
  // var list = makeList(compare(fromList, toList, dim));
  const list = addListMethods(compare(fromList, toList, dim))
  list.dim = (opts && opts.dimName) ? opts.dimName : dim
  return list
}

/**
 * Compare two groups by a dimension
 *
 * @param {A} ...
 * @param {B} ...
 * @param {dim} ...
 *
 * @memberof supergroup
 */
const compare = function (A, B, dim) {
  const a = _.chain(A).map((d) => {
    return `${d}`
  })
.value()
  const b = _.chain(B).map((d) => {
    return `${d}`
  })
.value()
  const comp = {}
  each(A, (d, i) => {
    comp[`${d}`] = {
      name: `${d}`,
      in: 'from',
      from: d,
      fromIdx: i,
      dim,
    }
  })
  each(B, (d, i) => {
    if ((`${d}`) in comp) {
      const c = comp[`${d}`]
      c.in = 'both'
      c.to = d
      c.toIdx = i
    }
    else {
      comp[`${d}`] = {
        name: `${d}`,
        in: 'to',
        to: d,
        toIdx: i,
        dim,
      }
    }
  })
  const list = _.chain(comp).values()
.sort((a, b) => {
    return (a.fromIdx - b.fromIdx) || (a.toIdx - b.toIdx)
  })
.map((d) => {
    var val = makeValue(d.name)
    assignIn(val, d)
    val.records = []
    if ('from' in d)
      val.records = val.records.concat(d.from.records)
    if ('to' in d)
      val.records = val.records.concat(d.to.records)
    return val
  })
.value()
  _.chain(list).map((d) => {
    d.parentList = list
    d.records.parentVal = d
  }).value()

  return list
}

/**
 * Concatenate two Values into a new one (??)
 *
 * @param {from} ...
 * @param {to} ...
 *
 * @memberof supergroup
 */
const compareValue = function (from, to) { // any reason to keep this?
  if (from.dim !== to.dim) {
    throw new Error('not sure what you\'re trying to do')
  }
  const name = `${from} to ${to}`
  const val = makeValue(name)
  val.from = from
  val.to = to
  val.depth = 0
  val.in = 'both'
  val.records = [].concat(from.records, to.records)
  val.records.parentVal = val
  val.dim = from.dim
  return val
}

/**
 * Sometimes a List gets turned into a standard array,
 *  sg.g., through slicing or sorting or filtering.
 *  addListMethods turns it back into a List
 *
 * `List` would be a constructor if IE10 supported
 * \_\_proto\_\_, so it pretends to be one instead.
 *
 * @param {Array} Array to be extended
 *
 * @memberof supergroup
 */

function addSupergroupMethods(arr) { return addListMethods(arr) }

function addListMethods(arr) {
  arr = arr || [] // KLUDGE for treelike
  if (arr.isSupergroupList)
    return arr
  for (const method in List.prototype) {
    Object.defineProperty(arr, method, {
      value: List.prototype[method],
    })
  }
  return arr
}

// can't easily subclass Array, so this explicitly puts the List
// methods on an Array that's supposed to be a List
function makeList(arr_arg) {
  const arr = []
  arr.push.apply(arr, arr_arg)
  addListMethods(arr)
  /*
      //arr.__proto__ = List.prototype;
      for(var method in List.prototype) {
          Object.defineProperty(arr, method, {
              value: List.prototype[method]
          });
      }
      */
  return arr
}

const hierarchicalTableToTree = function (data, parentProp, childProp) {
  // does not do the right thing if a value has two parents
  // also, does not yet fix depth numbers
  /*
                a
              / | \
             b  c  d
            / \ |  |
           e   f   g
            \ /
             h
        ex = [{p:'a', c:'b'}, {p:'a', c:'c'}, {p:'a', c:'d'},
              {p:'b', c:'e'}, {p:'b', c:'f'},
              {p:'c', c:'f'},
              {p:'d', c:'g'},
              {p:'e', c:'h'},
              {p:'f', c:'h'}
              ]
        p = _.supergroup(ex, ['p', 'c'])  // a,b,c,e
        c = p.leafNodes()                 // b,c,d,e,f,g,h
        tp = p.filter(d=>!c.lookup(d))    // top parents only: a
        cp = p.filter(d=>c.lookup(d))     // parent nodes that are also children: b,c,e
        cp = p.filter(d=>c.lookup(d)).map(d=>c.lookup(d)) // child nodes that are also parents
       */
  // testing:
  const ex = [{
    p: 'a',
    c: 'b',
  }, {
    p: 'a',
    c: 'c',
  }, {
    p: 'a',
    c: 'd',
  }, {
    p: 'b',
    c: 'e',
  }, {
    p: 'b',
    c: 'f',
  }, {
    p: 'c',
    c: 'f',
  }, {
    p: 'd',
    c: 'g',
  }, {
    p: 'e',
    c: 'h',
  }, {
    p: 'f',
    c: 'h',
  }]
  data = ex
  parentProp = 'p'
  childProp = 'c'
  // let parents = supergroup(ex, ['p', 'c']); // 2-level grouping with all parent/child pairs
  // const parents = supergroup(data, [parentProp, childProp]); // 2-level grouping with all parent/child pairs
  const p2c = supergroup(data, [parentProp, childProp])
  const c2p = supergroup(data, [childProp, parentProp])
  // [a, b, c, d, e, f]
  const childNodes = p2c.leafNodes()
  const actualLeafNodes = childNodes.filter(d => !p2c.lookup(d))
  const topLevelNodes = addSupergroupMethods([])
  actualLeafNodes.forEach((leaf) => {
    console.log(`leaf: ${leaf.namePathPlus()}`)
    let pointer = leaf
    while (pointer) {
      const parents = childNodes.filter(c => c.valueOf() == leaf.parent)
      console.log(`leaf parents: ${parents.map(d => d.namePathPlus())}`)
      if (parents.length) {
        parents.forEach((p) => {
          const clone = leaf.clone()
          p.children.push(clone)
          clone.parent = p
          clone.parentList = p.children
        })
        if (pointer.parent) {
          pointer = pointer.parent
          console.log(`pointer: ${pointer.namePathPlus()}`)
        }
        else {
          topLevelNodes.push(p2c.lookup(pointer))
          console.log(`done with ${leaf}`)
          pointer = null
        }
      }
      else {
        console.warn('figure this out')
        topLevelNodes.push(p2c.lookup(leaf.parent))
        break
      }
    }
  })
  // .map(d=>d.namePath())
  // ['d/g', 'e/h', 'f/h']

  // a ==> [b, c, e], b ==> [e, f], e ==> [h]
  const children = parents.leafNodes()
  // [b, c, d, e, f, f, g, h, h]
  const topLevelParents = addSupergroupMethods(
    _.differenceBy(parents.rawValues(), children.rawValues()).map(d => parents.find(p => p == d)),
  )
  // [a]
  _.difference(parents, topLevelParents).forEach((p) => {
    // console.log('processing', p.namePathPlus());
    let leaves = topLevelParents.leafNodes()
    // console.log('attaching ', p.namePathPlus(), 'to', leaves.namePathsPlus());
    leaves.forEach((leaf) => {
      if (leaf == p.valueOf()) {
        p.giveChildrenTo(leaf)
      }
    })
    leaves = topLevelParents.leafNodes()
    // console.log(' attached ', p.namePathPlus(), 'to', leaves.namePathsPlus());
  })
  return topLevelParents
  // const depths = _.uniq(asChildren.map(c => c.depth));
  // if (depths.length > 1) {
  //   asParent.depths = depths;
  // }
  // const minDepth = _.min(depths);
  // return addSupergroupMethods(topLevelParents);
}

function filterOutEmpty(recs, dim) {
  const func = _.isFunction(dim) ? dim : d => d[dim]
  recs = recs.filter(r => !_.isEmpty(func(r)) || (_.isNumber(func(r)) && isFinite(func(r)))) // _.isEmpty(0) === true
  return recs
}

export default {
  supergroup,
  addSupergroupMethods,
  sgDiffList: diffList,
  sgCompare: compare,
  sgCompareValue: compareValue,
  sgAggregate: aggregate,
  hierarchicalTableToTree,

  // FROM https://gist.github.com/AndreasBriese/1670507
  // Return aritmethic mean of the elements
  // if an iterator function is given, it is applied before
  sum(obj, iterator, context) {
    if (!iterator && _.isEmpty(obj))
      return 0
    let result = 0
    if (!iterator && _.isArray(obj)) {
      for (let i = obj.length - 1; i > -1; i -= 1) {
        result += obj[i]
      };
      return result
    };
    each(obj, (value, index, list) => {
      const computed = iterator ? iterator.call(context, value, index, list) : value
      result += computed
    })
    return result
  },
  mean(obj, iterator, context) {
    if (!iterator && _.isEmpty(obj))
      return Infinity
    if (!iterator && _.isArray(obj))
      return _.sum(obj) / obj.length
    if (_.isArray(obj) && !_.isEmpty(obj))
      return _.sum(obj, iterator, context) / obj.length
  },

  // Return median of the elements
  // if the object element number is odd the median is the
  // object in the "middle" of a sorted array
  // in case of an even number, the arithmetic mean of the two elements
  // in the middle (in case of characters or strings: obj[n/2-1] ) is returned.
  // if an iterator function is provided, it is applied before
  median(obj, iterator, context) {
    if (_.isEmpty(obj))
      return Infinity
    let tmpObj = []
    if (!iterator && _.isArray(obj)) {
      tmpObj = clone_(obj)
      tmpObj.sort((f, s) => { return f - s })
    }
    else {
      _.isArray(obj) && each(obj, (value, index, list) => {
        tmpObj.push(iterator ? iterator.call(context, value, index, list) : value)
        tmpObj.sort()
      })
    };
    return tmpObj.length % 2 ? tmpObj[Math.floor(tmpObj.length / 2)] : (_.isNumber(tmpObj[tmpObj.length / 2 - 1]) && _.isNumber(tmpObj[tmpObj.length / 2])) ? (tmpObj[tmpObj.length / 2 - 1] + tmpObj[tmpObj.length / 2]) / 2 : tmpObj[tmpObj.length / 2 - 1]
  },
}
