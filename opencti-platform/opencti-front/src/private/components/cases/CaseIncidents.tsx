import React, { FunctionComponent } from 'react';
import makeStyles from '@mui/styles/makeStyles';
import ListLines from '../../../components/list_lines/ListLines';
import { usePaginationLocalStorage } from '../../../utils/hooks/useLocalStorage';
import useQueryLoading from '../../../utils/hooks/useQueryLoading';
import { Filters } from '../../../components/list_lines';
import CaseIncidentsLines, { caseIncidentsLinesQuery } from './incidents/CaseIncidentsLines';
import { CaseIncidentLineDummy } from './incidents/CaseIncidentLine';
import useAuth from '../../../utils/hooks/useAuth';
import useEntityToggle from '../../../utils/hooks/useEntityToggle';
import ToolBar from '../data/ToolBar';
import Security from '../../../utils/Security';
import { KNOWLEDGE_KNUPDATE } from '../../../utils/hooks/useGranted';
import CaseIncidentCreation from './incidents/CaseIncidentCreation';
import ExportContextProvider from '../../../utils/ExportContextProvider';
import {
  CaseIncidentsLinesCasesPaginationQuery, CaseIncidentsLinesCasesPaginationQuery$variables,
} from './incidents/__generated__/CaseIncidentsLinesCasesPaginationQuery.graphql';
import { CaseIncidentLineCase_node$data } from './incidents/__generated__/CaseIncidentLineCase_node.graphql';

const useStyles = makeStyles(() => ({
  container: {
    margin: 0,
  },
}));

interface CaseIncidentsProps {
  inputValue?: string;
}

export const LOCAL_STORAGE_KEY_CASE_INCIDENT = 'view-cases-incidents';

const CaseIncidents: FunctionComponent<CaseIncidentsProps> = () => {
  const classes = useStyles();
  const { platformModuleHelpers: { isRuntimeFieldEnable } } = useAuth();
  const { viewStorage, helpers, paginationOptions } = usePaginationLocalStorage<CaseIncidentsLinesCasesPaginationQuery$variables>(
    LOCAL_STORAGE_KEY_CASE_INCIDENT,
    {
      searchTerm: '',
      sortBy: 'name',
      orderAsc: true,
      openExports: false,
      filters: {} as Filters,
    },
  );
  const {
    onToggleEntity,
    numberOfSelectedElements,
    handleClearSelectedElements,
    selectedElements,
    deSelectedElements,
    handleToggleSelectAll,
    selectAll,
  } = useEntityToggle<CaseIncidentLineCase_node$data>(LOCAL_STORAGE_KEY_CASE_INCIDENT);
  const renderLines = () => {
    const {
      sortBy,
      orderAsc,
      searchTerm,
      filters,
      openExports,
      numberOfElements,
    } = viewStorage;
    const isRuntimeSort = isRuntimeFieldEnable() ?? false;
    const dataColumns = {
      name: {
        label: 'Name',
        width: '25%',
        isSortable: true,
      },
      priority: {
        label: 'Priority',
        width: '5%',
        isSortable: true,
      },
      severity: {
        label: 'Severity',
        width: '5%',
        isSortable: true,
      },
      createdBy: {
        label: 'Author',
        width: '11%',
        isSortable: isRuntimeSort,
      },
      creator: {
        label: 'Creators',
        width: '11%',
        isSortable: isRuntimeSort,
      },
      objectLabel: {
        label: 'Labels',
        width: '15%',
        isSortable: false,
      },
      created: {
        label: 'Date',
        width: '10%',
        isSortable: true,
      },
      x_opencti_workflow_id: {
        label: 'Status',
        width: '8%',
        isSortable: true,
      },
      objectMarking: {
        label: 'Marking',
        width: '8%',
        isSortable: isRuntimeSort,
      },
    };
    const queryRef = useQueryLoading<CaseIncidentsLinesCasesPaginationQuery>(
      caseIncidentsLinesQuery,
      paginationOptions,
    );
    return (
      <ListLines
        sortBy={sortBy}
        orderAsc={orderAsc}
        dataColumns={dataColumns}
        handleSort={helpers.handleSort}
        handleSearch={helpers.handleSearch}
        handleAddFilter={helpers.handleAddFilter}
        handleRemoveFilter={helpers.handleRemoveFilter}
        handleToggleExports={helpers.handleToggleExports}
        handleToggleSelectAll={handleToggleSelectAll}
        selectAll={selectAll}
        openExports={openExports}
        exportEntityType="Case-Incident"
        keyword={searchTerm}
        filters={filters}
        paginationOptions={paginationOptions}
        numberOfElements={numberOfElements}
        iconExtension={true}
        availableFilterKeys={[
          'x_opencti_workflow_id',
          'assigneeTo',
          'priority',
          'severity',
          'markedBy',
          'labelledBy',
          'createdBy',
          'creator',
          'created_start_date',
          'created_end_date',
        ]}
      >
        {queryRef && (
          <React.Suspense
            fallback={
              <>
                {Array(20)
                  .fill(0)
                  .map((idx) => (
                    <CaseIncidentLineDummy key={idx} dataColumns={dataColumns} />
                  ))}
              </>
            }
          >
            <CaseIncidentsLines
              queryRef={queryRef}
              paginationOptions={paginationOptions}
              dataColumns={dataColumns}
              setNumberOfElements={helpers.handleSetNumberOfElements}
              selectedElements={selectedElements}
              deSelectedElements={deSelectedElements}
              onToggleEntity={onToggleEntity}
              selectAll={selectAll}
            />
            <ToolBar
              selectedElements={selectedElements}
              deSelectedElements={deSelectedElements}
              numberOfSelectedElements={numberOfSelectedElements}
              handleClearSelectedElements={handleClearSelectedElements}
              selectAll={selectAll}
              filters={{
                entity_type: [{ id: 'Case-Incident', value: 'Case-Incident' }],
              }}
            />
          </React.Suspense>
        )}
      </ListLines>
    );
  };
  return (
    <ExportContextProvider>
      <div className={classes.container}>
        {renderLines()}
        <Security needs={[KNOWLEDGE_KNUPDATE]}>
          <CaseIncidentCreation paginationOptions={paginationOptions} />
        </Security>
      </div>
    </ExportContextProvider>
  );
};

export default CaseIncidents;
