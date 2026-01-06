"use client";

import React from "react";

export interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className = "" }) => {
  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full divide-y divide-border-primary ${className}`}
      >
        {children}
      </table>
    </div>
  );
};

export interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
  children,
  className = "",
}) => {
  return (
    <thead className={`bg-background-tertiary ${className}`}>
      {children}
    </thead>
  );
};

export interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const TableBody: React.FC<TableBodyProps> = ({
  children,
  className = "",
}) => {
  return (
    <tbody
      className={`bg-background-secondary divide-y divide-border-primary ${className}`}
    >
      {children}
    </tbody>
  );
};

export interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  className = "",
  onClick,
}) => {
  return (
    <tr
      className={`${onClick ? "cursor-pointer hover:bg-background-tertiary" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

export interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHead: React.FC<TableHeadProps> = ({
  children,
  className = "",
}) => {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider align-top ${className}`}
    >
      {children}
    </th>
  );
};

export interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  colSpan?: number;
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  className = "",
  onClick,
  colSpan,
}) => {
  return (
    <td
      className={`px-4 py-4 text-sm text-text-primary align-top ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
};
