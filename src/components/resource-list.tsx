"use client";

import Link from "next/link";
import {
  getResourceSourceLabel,
  getResourceTypeLabel,
  isExternalResourceHref
} from "../../lib/resource-display";
import type { Resource } from "../../content/resources";
import styles from "./resource-list.module.css";

type ResourceListProps = {
  resources: Resource[];
  title?: string;
  emptyMessage: string;
};

export function ResourceList({
  resources,
  title,
  emptyMessage
}: ResourceListProps) {
  return (
    <section className={styles.section} aria-label={title ?? "Resources"}>
      {title ? (
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <span className={styles.count}>{resources.length}</span>
        </div>
      ) : null}

      {resources.length === 0 ? (
        <p className={styles.emptyState}>{emptyMessage}</p>
      ) : (
        <ul className={styles.list}>
          {resources.map((resource) => (
            <li className={styles.item} key={`${resource.type}-${resource.href}`}>
              <ResourceLink resource={resource} />
              <p className={styles.description}>{resource.description}</p>
              <ResourceMeta resource={resource} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResourceLink({ resource }: { resource: Resource }) {
  const external = isExternalResourceHref(resource.href);

  if (external) {
    return (
      <a className={styles.resourceLink} href={resource.href} rel="noreferrer" target="_blank">
        {resource.title}
      </a>
    );
  }

  return (
    <Link className={styles.resourceLink} href={resource.href}>
      {resource.title}
    </Link>
  );
}

function ResourceMeta({ resource }: { resource: Resource }) {
  const parts = [
    getResourceTypeLabel(resource.type),
    getResourceSourceLabel(resource.source),
    ...resource.tags,
    resource.date ?? ""
  ].filter(Boolean);

  return <p className={styles.meta}>{parts.join(" · ")}</p>;
}
