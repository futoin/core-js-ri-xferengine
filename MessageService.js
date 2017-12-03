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

const BaseService = require( './BaseService' );
const MessageFace = require( './MessageFace' );
const MessageTools = require( './MessageTools' );

/**
 * Message Service
 */
class MessageService extends BaseService {
    static get IFACE_IMPL() {
        return MessageFace;
    }

    _xferTools( reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        return new MessageTools( ccm );
    }

    _commonSend( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const p = reqinfo.params();

        p.recipient = p.recipient || null;
        p.ext_id = xt.makeExtId( p.sender, p.ext_id );

        xt.processMessage( as, p );
        as.add( ( as, msg_id ) => reqinfo.result( msg_id ) );
    }

    userSend( as, reqinfo ) {
        this._commonSend( as, reqinfo );
    }

    systemSend( as, reqinfo ) {
        this._commonSend( as, reqinfo );
    }

    /**
     * Register futoin.xfers.message interface with Executor
     * @alias MessageService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {MessageService} instance
     */
}

module.exports = MessageService;
