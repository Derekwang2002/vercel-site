# Domain glossary

## Board

The owner's private workspace for managing uploaded documents and their shares. A Board is never visible or enumerable to viewers.

## Owner

The single authenticated person who can add, replace, delete, preview, share, and revoke documents in the Board.

## Document

A Markdown or HTML file uploaded by the Owner. A Document remains private unless reached through the authenticated Private Repo or one of its active Shares.

## Private Repo

The read-only catalogue of every Document in the Board. It is unlisted from the public site and requires a dedicated reader password that grants no Board management permissions.

## Private Reader

A person authenticated with the Private Repo password. A Private Reader can list, read, and download every Document, but cannot upload, replace, delete, share, or revoke anything.

## Share

A revocable grant that exposes exactly one Document. A Share may expire, and knowledge of one Share must not reveal the Board or any other Document.

## Viewer

An unauthenticated person using a valid Share. A Viewer can read only the Document named by that Share and has no management permissions.
