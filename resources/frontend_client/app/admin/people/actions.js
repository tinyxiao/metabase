"use strict";

import { createAction } from "redux-actions";
import moment from "moment";
import { normalize, Schema, arrayOf } from "normalizr";

import MetabaseUtils from "metabase/lib/utils";

import { MODAL_INVITE_RESENT,
         MODAL_RESET_PASSWORD_MANUAL,
         MODAL_RESET_PASSWORD_EMAIL } from "./components/AdminPeople.react";


// HACK: just use our Angular resources for now
function AngularResourceProxy(serviceName, methods) {
    methods.forEach((methodName) => {
        this[methodName] = function(...args) {
            let service = angular.element(document.querySelector("body")).injector().get(serviceName);
            return service[methodName](...args).$promise;
        }
    });
}

// similar to createAction but accepts a (redux-thunk style) thunk and dispatches based on whether
// the promise returned from the thunk resolves or rejects, similar to redux-promise
function createThunkAction(actionType, actionThunkCreator) {
    return function(...actionArgs) {
        var thunk = actionThunkCreator(...actionArgs);
        return async function(dispatch, getState) {
            try {
                let payload = await thunk(dispatch, getState);
                dispatch({ type: actionType, payload });
            } catch (error) {
                dispatch({ type: actionType, payload: error, error: true });
                throw error;
            }
        }
    }
}

const user = new Schema('user');


// resource wrappers
const SessionApi = new AngularResourceProxy("Session", ["forgot_password"]);
const UserApi = new AngularResourceProxy("User", ["list", "update", "create", "delete", "update_password", "send_invite"]);


// action constants
export const CREATE_USER = 'CREATE_USER';
export const DELETE_USER = 'DELETE_USER';
export const FETCH_USERS = 'FETCH_USERS';
export const GRANT_ADMIN = 'GRANT_ADMIN';
export const RESEND_INVITE = 'RESEND_INVITE';
export const RESET_PASSWORD_EMAIL = 'RESET_PASSWORD_EMAIL';
export const RESET_PASSWORD_MANUAL = 'RESET_PASSWORD_MANUAL';
export const REVOKE_ADMIN = 'REVOKE_ADMIN';
export const SHOW_MODAL = 'SHOW_MODAL';
export const UPDATE_USER = 'UPDATE_USER';


// action creators

export const showModal = createAction(SHOW_MODAL);

export const createUser = createThunkAction(CREATE_USER, function(user) {
    return async function(dispatch, getState) {
        // apply any user defaults here
        user.is_superuser = false;

        let newUser = await UserApi.create(user);
        newUser.last_login = (newUser.last_login) ? moment(newUser.last_login) : null;

        return newUser;
    };
});

export const deleteUser = createThunkAction(DELETE_USER, function(user) {
    return async function(dispatch, getState) {
        await UserApi.delete({
            userId: user.id
        });
        return user;
    };
});

export const fetchUsers = createThunkAction(FETCH_USERS, function() {
    return async function(dispatch, getState) {
        let users = await UserApi.list();

        for (var u of users) {
            u.last_login = (u.last_login) ? moment(u.last_login) : null;
        }

        return normalize(users, arrayOf(user));
    };
});

export const grantAdmin = createThunkAction(GRANT_ADMIN, function(user) {
    return async function(dispatch, getState) {
        // give this user admin perms
        user.is_superuser = true;

        // do the update
        let updatedUser = await UserApi.update(user);
        updatedUser.last_login = (updatedUser.last_login) ? moment(updatedUser.last_login) : null;

        return updatedUser;
    };
});

export const resendInvite = createThunkAction(RESEND_INVITE, function(user) {
    return async function(dispatch, getState) {
        // make api call
        await UserApi.send_invite({id: user.id});

        dispatch(showModal({type: MODAL_INVITE_RESENT, details: {user: user}}));

        return user;
    };
});

export const resetPasswordManually = createThunkAction(RESET_PASSWORD_MANUAL, function(user) {
    return async function(dispatch, getState) {
        // generate a password
        const password = MetabaseUtils.generatePassword();

        await UserApi.update_password({id: user.id, password: password});

        dispatch(showModal({type: MODAL_RESET_PASSWORD_MANUAL, details: {password: password, user: user}}));

        return user;
    };
});

export const resetPasswordViaEmail = createThunkAction(RESET_PASSWORD_EMAIL, function(user) {
    return async function(dispatch, getState) {
        // trigger normal password reset process
        await SessionApi.forgot_password({email: user.email});

        dispatch(showModal({type: MODAL_RESET_PASSWORD_EMAIL, details: {user: user}}));

        return user;
    };
});

export const revokeAdmin = createThunkAction(REVOKE_ADMIN, function(user) {
    return async function(dispatch, getState) {
        // remove user admin perms
        user.is_superuser = false;

        // do the update
        let updatedUser = await UserApi.update(user);
        updatedUser.last_login = (updatedUser.last_login) ? moment(updatedUser.last_login) : null;

        return updatedUser;
    };
});

export const updateUser = createThunkAction(UPDATE_USER, function(user) {
    return async function(dispatch, getState) {
        let updatedUser = await UserApi.update(user);

        updatedUser.last_login = (updatedUser.last_login) ? moment(updatedUser.last_login) : null;

        return updatedUser;
    };
});
