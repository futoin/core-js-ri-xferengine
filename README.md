
  [![NPM Version](https://img.shields.io/npm/v/futoin-xferengine.svg?style=flat)](https://www.npmjs.com/package/futoin-xferengine)
  [![NPM Downloads](https://img.shields.io/npm/dm/futoin-xferengine.svg?style=flat)](https://www.npmjs.com/package/futoin-xferengine)
  [![Build Status](https://travis-ci.org/futoin/core-js-ri-xferengine.svg?branch=master)](https://travis-ci.org/futoin/core-js-ri-xferengine)
  [![stable](https://img.shields.io/badge/stability-stable-green.svg?style=flat)](https://www.npmjs.com/package/futoin-xferengine)

  [![NPM](https://nodei.co/npm/futoin-xferengine.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/futoin-xferengine/)

# About

**Work in progress. Technology preview, even though partially used in production.**

Universal cluster focused transaction engine concept implementation.

**Documentation** --> [FutoIn Guide](https://futoin.org/docs/xferengine/)

Reference implementation of:
 
    FTN19: FutoIn Interface - Transaction Engine
    Version: 1.0
    
* Spec: [FTN19: FutoIn Interface - Transaction Engine v1.x](http://specs.futoin.org/draft/preview/ftn19_if_xfer_engine-1.html)

## Features:

* Market cases (aka transaction domains):
    * Deposits & Withdrawals
    * Retail
    * Payments
    * Online Gaming
    * Fee bound to transaction (both deducted & extra)
* Multi-currency
    * ISO fiat currencies
    * Crypto currency namespace
    * Any custom currency namespace
* Advanced limits per transaction domain:
    * Per-account statistics
    * Daily, Weekly, Monthly limits for amounts & transaction count
    * Overdraft for balance
    * Dedicated "External" accounts for integration limits of third-party systems
* Clustering with protocol level interaction
* External Wallet (Seamless Wallet)
* DB-based event stream for reliable state distribution for ad-hoc systems

# Supported database types

* MySQL
* PostgreSQL
* SQLite
* Potentially, any other SQL-compliant supported by `futoin-database`

# BIG FAT WARNING

**Please DO NOT use it unless you really understand what it is. The package is published as essential open source part of derived custom closed source projects of different vendors.**

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

The concept is described in FutoIn specification: [FTN19: FutoIn Interface - Transaction Engine v1.x](http://specs.futoin.org/draft/preview/ftn19_if_xfer_engine-1.html)

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
<dt><a href="#BonusFace">BonusFace</a></dt>
<dd><p>Bonus Face</p>
</dd>
<dt><a href="#BonusService">BonusService</a></dt>
<dd><p>Bonus Service</p>
</dd>
<dt><a href="#CachedAccountsFace">CachedAccountsFace</a></dt>
<dd><p>Efficient cached AccountsFace with event-based cache invalidation</p>
<p>Keeps local cache of limits and invalidates based on LIVE events.</p>
</dd>
<dt><a href="#CachedLimitsFace">CachedLimitsFace</a></dt>
<dd><p>Efficient cached LimitsFace with event-based cache invalidation</p>
<p>Keeps local cache of limits and invalidates based on LIVE events.</p>
</dd>
<dt><a href="#DepositFace">DepositFace</a></dt>
<dd><p>Deposits Face</p>
</dd>
<dt><a href="#DepositService">DepositService</a></dt>
<dd><p>Deposits Service</p>
</dd>
<dt><a href="#DepositTools">DepositTools</a></dt>
<dd><p>XferTools with focus on Deposits use case</p>
</dd>
<dt><a href="#GamingFace">GamingFace</a></dt>
<dd><p>Gaming Face</p>
</dd>
<dt><a href="#GamingService">GamingService</a></dt>
<dd><p>Gaming Service</p>
</dd>
<dt><a href="#GamingTools">GamingTools</a></dt>
<dd><p>XferTools with focus on Gaming use case</p>
</dd>
<dt><a href="#GenericFace">GenericFace</a></dt>
<dd><p>Generic Face</p>
</dd>
<dt><a href="#GenericService">GenericService</a></dt>
<dd><p>Generic Service</p>
</dd>
<dt><a href="#LimitsFace">LimitsFace</a></dt>
<dd><p>Limits Face</p>
</dd>
<dt><a href="#LimitsService">LimitsService</a></dt>
<dd><p>Limits Service</p>
</dd>
<dt><a href="#MessageFace">MessageFace</a></dt>
<dd><p>Message Face</p>
</dd>
<dt><a href="#MessageService">MessageService</a></dt>
<dd><p>Message Service</p>
</dd>
<dt><a href="#MessageTools">MessageTools</a></dt>
<dd><p>XferTools with focus on Message processing</p>
</dd>
<dt><a href="#PaymentFace">PaymentFace</a></dt>
<dd><p>Payments Face</p>
</dd>
<dt><a href="#PaymentService">PaymentService</a></dt>
<dd><p>Payments Service</p>
</dd>
<dt><a href="#PaymentTools">PaymentTools</a></dt>
<dd><p>XferTools with focus on Payments use case</p>
</dd>
<dt><a href="#PeerFace">PeerFace</a></dt>
<dd><p>Peer Face</p>
</dd>
<dt><a href="#PeerService">PeerService</a></dt>
<dd><p>Peer Service</p>
</dd>
<dt><a href="#RetailFace">RetailFace</a></dt>
<dd><p>Payments Face</p>
</dd>
<dt><a href="#RetailService">RetailService</a></dt>
<dd><p>Retail Service</p>
</dd>
<dt><a href="#RetailTools">RetailTools</a></dt>
<dd><p>XferTools with focus on Retail use case</p>
</dd>
<dt><a href="#UUIDTool">UUIDTool</a></dt>
<dd><p>Extended UUIDTool with focus on collision safety in whole history
of particular instance.</p>
</dd>
<dt><a href="#WithdrawFace">WithdrawFace</a></dt>
<dd><p>Witdrawals Face</p>
</dd>
<dt><a href="#WithdrawService">WithdrawService</a></dt>
<dd><p>Withdrawals Service</p>
</dd>
<dt><a href="#XferCCM">XferCCM</a></dt>
<dd><p>Special CCM implementation for XferCore</p>
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
<a name="AccountsService"></a>

## AccountsService
Accounts Service

**Kind**: global class  
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

### BaseFace.LATEST\_VERSION
Latest supported FTN17 version

**Kind**: static property of [<code>BaseFace</code>](#BaseFace)  
<a name="BaseFace.PING_VERSION"></a>

### BaseFace.PING\_VERSION
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

### baseService.\_checkType(type, val) ⇒ <code>boolean</code>
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

<a name="BonusFace"></a>

## BonusFace
Bonus Face

**Kind**: global class  
<a name="BonusService"></a>

## BonusService
Bonus Service

**Kind**: global class  
<a name="CachedAccountsFace"></a>

## CachedAccountsFace
Efficient cached AccountsFace with event-based cache invalidation

Keeps local cache of limits and invalidates based on LIVE events.

**Kind**: global class  
<a name="CachedAccountsFace.register"></a>

### CachedAccountsFace.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>CachedAccountsFace</code>](#CachedAccountsFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;&lt;latest&gt;&quot;</code> | interface version to use |

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

<a name="DepositFace"></a>

## DepositFace
Deposits Face

**Kind**: global class  
<a name="DepositService"></a>

## DepositService
Deposits Service

**Kind**: global class  
<a name="DepositTools"></a>

## DepositTools
XferTools with focus on Deposits use case

**Kind**: global class  
<a name="GamingFace"></a>

## GamingFace
Gaming Face

**Kind**: global class  
<a name="GamingService"></a>

## GamingService
Gaming Service

**Kind**: global class  
<a name="GamingTools"></a>

## GamingTools
XferTools with focus on Gaming use case

**Kind**: global class  
<a name="GenericFace"></a>

## GenericFace
Generic Face

**Kind**: global class  
<a name="GenericService"></a>

## GenericService
Generic Service

**Kind**: global class  
<a name="LimitsFace"></a>

## LimitsFace
Limits Face

**Kind**: global class  
<a name="LimitsService"></a>

## LimitsService
Limits Service

**Kind**: global class  
<a name="MessageFace"></a>

## MessageFace
Message Face

**Kind**: global class  
<a name="MessageService"></a>

## MessageService
Message Service

**Kind**: global class  
<a name="MessageTools"></a>

## MessageTools
XferTools with focus on Message processing

**Kind**: global class  
<a name="PaymentFace"></a>

## PaymentFace
Payments Face

**Kind**: global class  
<a name="PaymentService"></a>

## PaymentService
Payments Service

**Kind**: global class  
<a name="PaymentTools"></a>

## PaymentTools
XferTools with focus on Payments use case

**Kind**: global class  
<a name="PeerFace"></a>

## PeerFace
Peer Face

**Kind**: global class  
<a name="PeerService"></a>

## PeerService
Peer Service

**Kind**: global class  
<a name="RetailFace"></a>

## RetailFace
Payments Face

**Kind**: global class  
<a name="RetailService"></a>

## RetailService
Retail Service

**Kind**: global class  
<a name="RetailTools"></a>

## RetailTools
XferTools with focus on Retail use case

**Kind**: global class  
<a name="UUIDTool"></a>

## UUIDTool
Extended UUIDTool with focus on collision safety in whole history
of particular instance.

**Kind**: global class  

* [UUIDTool](#UUIDTool)
    * [.addXfer(xfer, val)](#UUIDTool.addXfer)
    * [.genXfer(xfer)](#UUIDTool.genXfer) ⇒ <code>string</code>

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

<a name="WithdrawFace"></a>

## WithdrawFace
Witdrawals Face

**Kind**: global class  
<a name="WithdrawService"></a>

## WithdrawService
Withdrawals Service

**Kind**: global class  
<a name="XferCCM"></a>

## XferCCM
Special CCM implementation for XferCore

**Kind**: global class  

* [XferCCM](#XferCCM)
    * [.registerServices(as, executor)](#XferCCM+registerServices)
    * [.registerEventServices(as, executor)](#XferCCM+registerEventServices)
    * [.registerCurrencyServices(as, executor)](#XferCCM+registerCurrencyServices)
    * [.registerLimitServices(as, executor)](#XferCCM+registerLimitServices)
    * [.registerAccountServices(as, executor)](#XferCCM+registerAccountServices)
    * [.makeManualAlias(iface, key)](#XferCCM+makeManualAlias) ⇒ <code>string</code>
    * [.registerOnDemand(iface, flavour, callback)](#XferCCM+registerOnDemand)
    * [.xferIface(as, iface, account)](#XferCCM+xferIface)

<a name="XferCCM+registerServices"></a>

### xferCCM.registerServices(as, executor)
Register all services required for operation

**Kind**: instance method of [<code>XferCCM</code>](#XferCCM)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | async step interface |
| executor | <code>Executor</code> | internal protected executor |

<a name="XferCCM+registerEventServices"></a>

### xferCCM.registerEventServices(as, executor)
Register event services required for operation

**Kind**: instance method of [<code>XferCCM</code>](#XferCCM)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | async step interface |
| executor | <code>Executor</code> | internal protected executor |

<a name="XferCCM+registerCurrencyServices"></a>

### xferCCM.registerCurrencyServices(as, executor)
Register currency services required for operation

**Kind**: instance method of [<code>XferCCM</code>](#XferCCM)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | async step interface |
| executor | <code>Executor</code> | internal protected executor |

<a name="XferCCM+registerLimitServices"></a>

### xferCCM.registerLimitServices(as, executor)
Register limit services required for operation

**Kind**: instance method of [<code>XferCCM</code>](#XferCCM)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | async step interface |
| executor | <code>Executor</code> | internal protected executor |

<a name="XferCCM+registerAccountServices"></a>

### xferCCM.registerAccountServices(as, executor)
Register account services required for operation

**Kind**: instance method of [<code>XferCCM</code>](#XferCCM)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | async step interface |
| executor | <code>Executor</code> | internal protected executor |

<a name="XferCCM+makeManualAlias"></a>

### xferCCM.makeManualAlias(iface, key) ⇒ <code>string</code>
Get manual alias for specific iface & key combination

**Kind**: instance method of [<code>XferCCM</code>](#XferCCM)  
**Returns**: <code>string</code> - - manual key to be used with registerOnDemand()  

| Param | Type | Description |
| --- | --- | --- |
| iface | <code>string</code> | interface identifier |
| key | <code>string</code> | arbitrary key, typically account # |

<a name="XferCCM+registerOnDemand"></a>

### xferCCM.registerOnDemand(iface, flavour, callback)
Register callback for on-demand interface creation

**Kind**: instance method of [<code>XferCCM</code>](#XferCCM)  

| Param | Type | Description |
| --- | --- | --- |
| iface | <code>string</code> | full iface identifier |
| flavour | <code>string</code> | a type of interface implementation |
| callback | <code>callable</code> | callback to register interface |

<a name="XferCCM+xferIface"></a>

### xferCCM.xferIface(as, iface, account)
Get interface with on-demand logic

**Kind**: instance method of [<code>XferCCM</code>](#XferCCM)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | async step interface |
| iface | <code>string</code> | full iface identifier |
| account | <code>string</code> | related account ID |

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
<a name="CurrencyInfoService"></a>

## CurrencyInfoService
Currency Manage Service

**Kind**: global class  
<a name="CurrencyManageFace"></a>

## CurrencyManageFace
Currency Management Face

**Kind**: global class  
<a name="CurrencyManageService"></a>

## CurrencyManageService
Currency Manage Service

**Kind**: global class  


*documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown)*.


