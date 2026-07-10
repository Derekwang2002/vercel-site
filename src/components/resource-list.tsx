"use client";

import Link from "next/link";
import {
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
  return (
    <div className={styles.meta}>
      <span className={styles.typeBadge}>{getResourceTypeLabel(resource.type)}</span>

      {resource.tags.length > 0 ? (
        <span aria-label="Tags" className={styles.tagList} role="group">
          {resource.tags.map((tag) => (
            <span className={styles.tag} key={tag}>
              {tag}
            </span>
          ))}
        </span>
      ) : null}

      {resource.date ? (
        <time className={styles.metaDate} dateTime={resource.date}>
          {formatResourceDate(resource.date)}
        </time>
      ) : null}
    </div>
  );
}

function formatResourceDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(parsed);
}
