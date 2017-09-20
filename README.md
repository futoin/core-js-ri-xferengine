
  [![NPM Version](https://img.shields.io/npm/v/futoin-xferengine.svg?style=flat)](https://www.npmjs.com/package/futoin-xferengine)
  [![NPM Downloads](https://img.shields.io/npm/dm/futoin-xferengine.svg?style=flat)](https://www.npmjs.com/package/futoin-xferengine)
  [![Build Status](https://travis-ci.org/futoin/core-js-ri-xferengine.svg?branch=master)](https://travis-ci.org/futoin/core-js-ri-xferengine)
  [![stable](https://img.shields.io/badge/stability-stable-green.svg?style=flat)](https://www.npmjs.com/package/futoin-xferengine)

  [![NPM](https://nodei.co/npm/futoin-xferengine.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/futoin-xferengine/)

# FutoIn reference implementation

Reference implementation of:
 
    FTN19: FutoIn Interface - Transaction Engine
    Version: 1.0
    
* Spec: [FTN19: FutoIn Interface - Transaction Engine v1.x](http://specs.futoin.org/final/preview/ftn18_if_xfer_engine-1.html)

[Web Site](http://futoin.org/)

# About

Work in progress.

# Supported database types

* MySQL
* PostgreSQL
* SQLite
* Potentially, any other SQL-compliant supported by `futoin-database`

# Installation for Node.js

Command line:
```sh
$ yarn add futoin-xferengine 
```
or
```sh
$ npm install futoin-xferengine --save
```


# Concept

More detailed concept is in the FTN19 spec.


# Examples

## 1. 

```javascript
```


    
# API documentation

The concept is described in FutoIn specification: [FTN19: FutoIn Interface - Transaction Engine v1.x](http://specs.futoin.org/final/preview/ftn18_if_xfer_engine-1.html)

## Classes

<dl>
<dt><a href="#BaseFace">BaseFace</a></dt>
<dd><p>Base Face with neutral common functionality</p>
</dd>
<dt><a href="#CachedLimitsFace">CachedLimitsFace</a></dt>
<dd><p>Efficient cached LimitsFace with event-based cache invalidation</p>
<p>Keeps local cache of limits and invalidates based on LIVE events.</p>
</dd>
<dt><a href="#LimitsFace">LimitsFace</a></dt>
<dd><p>Limits Face</p>
</dd>
<dt><a href="#LimitsService">LimitsService</a></dt>
<dd><p>Limits Service</p>
</dd>
</dl>

<a name="BaseFace"></a>

## BaseFace
Base Face with neutral common functionality

**Kind**: global class  
**Note**: Not official API  

* [BaseFace](#BaseFace)
    * [.LATEST_VERSION](#BaseFace.LATEST_VERSION)
    * [.PING_VERSION](#BaseFace.PING_VERSION)
    * [.register(as, ccm, name, endpoint, [credentials], [options])](#BaseFace.register)

<a name="BaseFace.LATEST_VERSION"></a>

### BaseFace.LATEST_VERSION
Latest supported FTN17 version

**Kind**: static property of [<code>BaseFace</code>](#BaseFace)  
<a name="BaseFace.PING_VERSION"></a>

### BaseFace.PING_VERSION
Latest supported FTN4 version

**Kind**: static property of [<code>BaseFace</code>](#BaseFace)  
<a name="BaseFace.register"></a>

### BaseFace.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>BaseFace</code>](#BaseFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;1.0&quot;</code> | interface version to use |

<a name="CachedLimitsFace"></a>

## CachedLimitsFace
Efficient cached LimitsFace with event-based cache invalidation

Keeps local cache of limits and invalidates based on LIVE events.

**Kind**: global class  
<a name="LimitsFace"></a>

## LimitsFace
Limits Face

**Kind**: global class  
<a name="LimitsService"></a>

## LimitsService
Limits Service

**Kind**: global class  
<a name="LimitsService.register"></a>

### LimitsService.register(as, executor, options) ⇒ <code>ManageService</code>
Register futoin.currency.manage interface with Executor

**Kind**: static method of [<code>LimitsService</code>](#LimitsService)  
**Returns**: <code>ManageService</code> - instance  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| executor | <code>Executor</code> | executor instance |
| options | <code>object</code> | implementation defined options |



*documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown)*.


