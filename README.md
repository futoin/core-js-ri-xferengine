
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
<dt><a href="#AccountsFace">AccountsFace</a></dt>
<dd><p>Accounts Face</p>
</dd>
<dt><a href="#AccountsService">AccountsService</a></dt>
<dd><p>Accounts Service</p>
</dd>
<dt><a href="#BaseFace">BaseFace</a></dt>
<dd><p>Base Face with neutral common registration functionality</p>
</dd>
<dt><a href="#BaseService">BaseService</a></dt>
<dd><p>Base Service with common registration logic</p>
</dd>
<dt><a href="#CachedLimitsFace">CachedLimitsFace</a></dt>
<dd><p>Efficient cached LimitsFace with event-based cache invalidation</p>
<p>Keeps local cache of limits and invalidates based on LIVE events.</p>
</dd>
<dt><a href="#DepositsFace">DepositsFace</a></dt>
<dd><p>Deposits Face</p>
</dd>
<dt><a href="#DepositsService">DepositsService</a></dt>
<dd><p>Deposits Service</p>
</dd>
<dt><a href="#LimitsFace">LimitsFace</a></dt>
<dd><p>Limits Face</p>
</dd>
<dt><a href="#LimitsService">LimitsService</a></dt>
<dd><p>Limits Service</p>
</dd>
<dt><a href="#UUIDTool">UUIDTool</a></dt>
<dd><p>Common tool for UUID generation and use in transactions</p>
</dd>
<dt><a href="#CurrencyCacheInfoFace">CurrencyCacheInfoFace</a></dt>
<dd><p>An efficient version of Currency/InfoFace.</p>
<p>Keeps local cache of currencies and exchange rates.
Listens on related event stream for changes as LIVE component.</p>
</dd>
<dt><a href="#CurrencyInfoFace">CurrencyInfoFace</a></dt>
<dd><p>Currency Information Face</p>
</dd>
<dt><a href="#CurrencyInfoService">CurrencyInfoService</a></dt>
<dd><p>Currency Manage Service</p>
</dd>
<dt><a href="#CurrencyManageFace">CurrencyManageFace</a></dt>
<dd><p>Currency Management Face</p>
</dd>
<dt><a href="#CurrencyManageService">CurrencyManageService</a></dt>
<dd><p>Currency Manage Service</p>
</dd>
</dl>

<a name="AccountsFace"></a>

## AccountsFace
Accounts Face

**Kind**: global class  
<a name="AccountsFace.register"></a>

### AccountsFace.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>AccountsFace</code>](#AccountsFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;&lt;latest&gt;&quot;</code> | interface version to use |

<a name="AccountsService"></a>

## AccountsService
Accounts Service

**Kind**: global class  
<a name="AccountsService.register"></a>

### AccountsService.register(as, executor, options) ⇒ [<code>AccountsService</code>](#AccountsService)
Register futoin.xfer.accounts interface with Executor

**Kind**: static method of [<code>AccountsService</code>](#AccountsService)  
**Returns**: [<code>AccountsService</code>](#AccountsService) - instance  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| executor | <code>Executor</code> | executor instance |
| options | <code>object</code> | implementation defined options |

<a name="BaseFace"></a>

## BaseFace
Base Face with neutral common registration functionality

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

<a name="BaseService"></a>

## BaseService
Base Service with common registration logic

**Kind**: global class  

* [BaseService](#BaseService)
    * _instance_
        * [._checkType(type, val)](#BaseService+_checkType) ⇒ <code>boolean</code>
    * _static_
        * [.register(as, executor, options)](#BaseService.register) ⇒ [<code>LimitsService</code>](#LimitsService)

<a name="BaseService+_checkType"></a>

### baseService._checkType(type, val) ⇒ <code>boolean</code>
Check value against type in spec of implemented interface

**Kind**: instance method of [<code>BaseService</code>](#BaseService)  
**Returns**: <code>boolean</code> - result of check  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | name of defined type |
| val | <code>\*</code> | value to check |

<a name="BaseService.register"></a>

### BaseService.register(as, executor, options) ⇒ [<code>LimitsService</code>](#LimitsService)
Register futoin.xfers.limits interface with Executor

**Kind**: static method of [<code>BaseService</code>](#BaseService)  
**Returns**: [<code>LimitsService</code>](#LimitsService) - instance  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| executor | <code>Executor</code> | executor instance |
| options | <code>object</code> | implementation defined options |

<a name="CachedLimitsFace"></a>

## CachedLimitsFace
Efficient cached LimitsFace with event-based cache invalidation

Keeps local cache of limits and invalidates based on LIVE events.

**Kind**: global class  
<a name="CachedLimitsFace.register"></a>

### CachedLimitsFace.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>CachedLimitsFace</code>](#CachedLimitsFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;&lt;latest&gt;&quot;</code> | interface version to use |

<a name="DepositsFace"></a>

## DepositsFace
Deposits Face

**Kind**: global class  
<a name="DepositsFace.register"></a>

### DepositsFace.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>DepositsFace</code>](#DepositsFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;&lt;latest&gt;&quot;</code> | interface version to use |

<a name="DepositsService"></a>

## DepositsService
Deposits Service

**Kind**: global class  
<a name="LimitsFace"></a>

## LimitsFace
Limits Face

**Kind**: global class  
<a name="LimitsFace.register"></a>

### LimitsFace.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>LimitsFace</code>](#LimitsFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;&lt;latest&gt;&quot;</code> | interface version to use |

<a name="LimitsService"></a>

## LimitsService
Limits Service

**Kind**: global class  
<a name="LimitsService.register"></a>

### LimitsService.register(as, executor, options) ⇒ [<code>LimitsService</code>](#LimitsService)
Register futoin.xfers.limits interface with Executor

**Kind**: static method of [<code>LimitsService</code>](#LimitsService)  
**Returns**: [<code>LimitsService</code>](#LimitsService) - instance  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| executor | <code>Executor</code> | executor instance |
| options | <code>object</code> | implementation defined options |

<a name="UUIDTool"></a>

## UUIDTool
Common tool for UUID generation and use in transactions

**Kind**: global class  

* [UUIDTool](#UUIDTool)
    * [.genBin()](#UUIDTool.genBin) ⇒ <code>Buffer</code>
    * [.genB64()](#UUIDTool.genB64) ⇒ <code>string</code>
    * [.addXfer(xfer, val)](#UUIDTool.addXfer)
    * [.genXfer(xfer)](#UUIDTool.genXfer) ⇒ <code>string</code>

<a name="UUIDTool.genBin"></a>

### UUIDTool.genBin() ⇒ <code>Buffer</code>
Generate UUID v4

**Kind**: static method of [<code>UUIDTool</code>](#UUIDTool)  
**Returns**: <code>Buffer</code> - buffer of 16 items  
<a name="UUIDTool.genB64"></a>

### UUIDTool.genB64() ⇒ <code>string</code>
Generate UUID v4 encoded in Base64 without padding

**Kind**: static method of [<code>UUIDTool</code>](#UUIDTool)  
**Returns**: <code>string</code> - 22 characters  
<a name="UUIDTool.addXfer"></a>

### UUIDTool.addXfer(xfer, val)
Call on xfer to ensure whole history uniqueness (just in case)

**Kind**: static method of [<code>UUIDTool</code>](#UUIDTool)  

| Param | Type | Description |
| --- | --- | --- |
| xfer | <code>XferBuilder</code> | xfer builder object |
| val | <code>string</code> | UUID in Base64 format without padding |

<a name="UUIDTool.genXfer"></a>

### UUIDTool.genXfer(xfer) ⇒ <code>string</code>
Generate UUID v4 in scope of transaction

**Kind**: static method of [<code>UUIDTool</code>](#UUIDTool)  
**Returns**: <code>string</code> - UUID encoded in Base64 without padding  

| Param | Type | Description |
| --- | --- | --- |
| xfer | <code>XferBuilder</code> | xfer builder object |

<a name="CurrencyCacheInfoFace"></a>

## CurrencyCacheInfoFace
An efficient version of Currency/InfoFace.

Keeps local cache of currencies and exchange rates.
Listens on related event stream for changes as LIVE component.

**Kind**: global class  
<a name="CurrencyCacheInfoFace.register"></a>

### CurrencyCacheInfoFace.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>CurrencyCacheInfoFace</code>](#CurrencyCacheInfoFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;&lt;latest&gt;&quot;</code> | interface version to use |

<a name="CurrencyInfoFace"></a>

## CurrencyInfoFace
Currency Information Face

**Kind**: global class  
<a name="CurrencyInfoFace.register"></a>

### CurrencyInfoFace.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>CurrencyInfoFace</code>](#CurrencyInfoFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;&lt;latest&gt;&quot;</code> | interface version to use |

<a name="CurrencyInfoService"></a>

## CurrencyInfoService
Currency Manage Service

**Kind**: global class  
<a name="CurrencyInfoService.register"></a>

### CurrencyInfoService.register(as, executor, options) ⇒ <code>ManageService</code>
Register futoin.currency.manage interface with Executor

**Kind**: static method of [<code>CurrencyInfoService</code>](#CurrencyInfoService)  
**Returns**: <code>ManageService</code> - instance  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| executor | <code>Executor</code> | executor instance |
| options | <code>object</code> | implementation defined options |

<a name="CurrencyManageFace"></a>

## CurrencyManageFace
Currency Management Face

**Kind**: global class  
<a name="CurrencyManageFace.register"></a>

### CurrencyManageFace.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>CurrencyManageFace</code>](#CurrencyManageFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;&lt;latest&gt;&quot;</code> | interface version to use |

<a name="CurrencyManageService"></a>

## CurrencyManageService
Currency Manage Service

**Kind**: global class  
<a name="CurrencyManageService.register"></a>

### CurrencyManageService.register(as, executor, options) ⇒ <code>ManageService</code>
Register futoin.currency.manage interface with Executor

**Kind**: static method of [<code>CurrencyManageService</code>](#CurrencyManageService)  
**Returns**: <code>ManageService</code> - instance  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| executor | <code>Executor</code> | executor instance |
| options | <code>object</code> | implementation defined options |



*documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown)*.


