'use strict';

/**
 * @file
 *
 * Copyright 2017 FutoIn Project (https://futoin.org)
 * Copyright 2017 Andrey Galkin <andrey@futoin.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const XferTools = require( './XferTools' );
const UUIDTool = require( './UUIDTool' );
const SpecTools = require( 'futoin-invoker/SpecTools' );

const {
    DB_MESSAGE_TABLE,
    EVTGEN_ALIAS,
    historyTimeBarrier,
} = require( './main' );


const TypeSpec = {
    types: {
        HolderID: "string",
        MessageInfo : {
            type: 'map',
            fields: {
                sender: 'HolderID',
                recipient: {
                    type: 'HolderID',
                    optional: true,
                },
                ext_id : 'string',
                orig_ts: 'string',
                data: 'map',
                rel_id : {
                    type: 'string',
                    optional: true,
                },
            },
        },
    },
};

/**
 * XferTools with focus on Message processing
 */
class MessageTools extends XferTools {
    constructor( ccm ) {
        super( ccm, 'Payments' );
    }

    _checkExistingMessage( as, msg ) {
        //---
        const barrier = historyTimeBarrier();

        if ( barrier.isAfter( msg.orig_ts ) ) {
            as.error( 'OriginalTooOld' );
        }

        //---
        this.db.select( DB_MESSAGE_TABLE )
            .where( 'ext_id', msg.ext_id )
            .executeAssoc( as );

        as.add( ( as, rows ) => {
            if ( !rows.length ) {
                return;
            }

            const r = rows[0];
            msg.id = r.uuidb64;

            //---
            if ( ( msg.sender !== r.sender ) ||
                 ( msg.recipient !== r.recipient ) ||
                 ( JSON.stringify( msg.data ) !== r.data ) ||
                 ( msg.rel_id !== r.rel_uuidb64 )
            ) {
                as.error( 'OriginalMismatch' );
            }
        } );
    }

    _checkRelId( as, msg ) {
        if ( !msg.rel_id ) {
            return;
        }

        const q = this.db.select( DB_MESSAGE_TABLE )
            .get( 'uuidb64' )
            .where( 'uuidb64', msg.rel_id );

        // user message
        if ( msg.recipient === null ) {
            q.where( [
                'OR',
                { sender: msg.sender },
                { recipient: msg.sender },
            ] );
        }

        q.execute( as );

        as.add( ( as, { rows } ) => {
            if ( !rows.length ) {
                as.error( 'UnknownRelID' );
            }
        } );
    }

    _recordMessage( as, msg ) {
        if ( msg.id ) {
            return;
        }

        const dbxfer = this.db.newXfer();

        //---
        msg.id = UUIDTool.genXfer( dbxfer );

        //---
        dbxfer.insert( DB_MESSAGE_TABLE )
            .set( {
                uuidb64: msg.id,
                ext_id: msg.ext_id,
                sender: msg.sender,
                recipient: msg.recipient,
                data: JSON.stringify( msg.data ),
                rel_uuidb64: msg.rel_id,
                created: dbxfer.helpers().now(),
            } );

        //---
        this._ccm.iface( EVTGEN_ALIAS )
            .addXferEvent( dbxfer, 'MSG', msg );


        //---
        this._processLimits(
            as, dbxfer,
            ( msg.recipient === null ) ? 'Misc' : 'Personnel',
            msg.sender, null, {
                message_daily_cnt: 1,
                message_weekly_cnt: 1,
                message_monthly_cnt: 1,
            }
        );

        as.add( ( as ) => dbxfer.execute( as ) );
    }

    processMessage( as, msg ) {
        as.add( ( as ) => {
            // check data for consistency
            // TODO; disable for production
            if ( !SpecTools.checkType( TypeSpec, 'MessageInfo', msg ) ) {
                as.error( 'XferError', 'Invalid message data' );
            }
        } );
        as.add(
            ( as ) => {
                as.add( ( as ) => this._checkExistingMessage( as, msg ) );
                as.add( ( as ) => this._checkRelId( as, msg ) );
                as.add( ( as ) => this._recordMessage( as, msg ) );
                as.add( ( as ) => as.success( msg.id ) );
            },
            ( as, err ) => this._handleError( as, err, 'MSG_ERR', msg, msg.sender )
        );
    }
}

module.exports = MessageTools;
