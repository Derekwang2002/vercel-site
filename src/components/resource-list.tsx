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
  locale?: "en" | "zh";
  title?: string;
  emptyMessage: string;
};

export function ResourceList({
  resources,
  locale = "en",
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
              <ResourceLink locale={locale} resource={resource} />
              <p className={styles.description}>{resource.description}</p>
              <ResourceMeta locale={locale} resource={resource} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResourceLink({ locale, resource }: { locale: "en" | "zh"; resource: Resource }) {
  const external = isExternalResourceHref(resource.href);

  if (external) {
    return (
      <a className={styles.resourceLink} href={resource.href} rel="noreferrer" target="_blank">
        {resource.title}
      </a>
    );
  }

  if (resource.type === "demo") {
    return (
      <a className={styles.resourceLink} href={resource.href}>
        {resource.title}
      </a>
    );
  }

  return (
    <Link className={styles.resourceLink} href={`${locale === "zh" ? "/zh" : ""}${resource.href}`}>
      {resource.title}
    </Link>
  );
}

function ResourceMeta({ locale, resource }: { locale: "en" | "zh"; resource: Resource }) {
  return (
    <div className={styles.meta}>
      <span className={styles.typeBadge}>{locale === "zh" && resource.type === "demo" ? "演示" : getResourceTypeLabel(resource.type)}</span>

      {resource.tags.length > 0 ? (
        <span aria-hidden="true" className={styles.metaSeparator}>
          |
        </span>
      ) : null}

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
          {formatResourceDate(resource.date, locale)}
        </time>
      ) : null}
    </div>
  );
}

function formatResourceDate(date: string, locale: "en" | "zh"): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(parsed);
}
