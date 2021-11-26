import React, { Component } from 'react';
import * as PropTypes from 'prop-types';
import * as R from 'ramda';
import Axios from 'axios';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import List from '@material-ui/core/List';
import { v4 as uuid } from 'uuid';
import Typography from '@material-ui/core/Typography';
import { withStyles } from '@material-ui/core';
import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import { createFragmentContainer } from 'react-relay';
import graphql from 'babel-plugin-relay/macro';
import { Field, Form, Formik } from 'formik';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import MenuItem from '@material-ui/core/MenuItem';
import DialogActions from '@material-ui/core/DialogActions';
import Checkbox from '@material-ui/core/Checkbox';
import * as Yup from 'yup';
import { Link, withRouter } from 'react-router-dom';
import { ArrowDropDown, ArrowDropUp } from '@material-ui/icons';
import ItemIcon from '../../../components/ItemIcon';
import { defaultValue } from '../../../utils/Graph';
import inject18n from '../../../components/i18n';
import { observableKeyToType, resolveLink } from '../../../utils/Entity';
import PendingFileToolBar from './PendingFileToolBar';
import { commitMutation, MESSAGING$ } from '../../../relay/environment';
import { fileManagerAskJobImportMutation } from '../common/files/FileManager';
import SelectField from '../../../components/SelectField';
import { convertStixType } from '../../../utils/String';

const styles = (theme) => ({
  container: {
    margin: 0,
  },
  paper: {
    height: '100%',
    minHeight: '100%',
    margin: '10px 0 0 0',
    padding: '15px',
    borderRadius: 6,
  },
  paperList: {
    height: '100%',
    minHeight: '100%',
    margin: '10px 0 0 0',
    padding: '15px',
    borderRadius: 6,
  },
  title: {
    float: 'left',
    textTransform: 'uppercase',
  },
  item: {
    paddingLeft: 10,
    height: 50,
  },
  gridContainer: {
    marginBottom: 20,
  },
  buttons: {
    marginTop: 20,
    textAlign: 'right',
  },
  linesContainer: {
    marginTop: 0,
  },
  itemHead: {
    paddingLeft: 10,
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  bodyItem: {
    height: '100%',
    fontSize: 13,
  },
  itemIcon: {
    color: theme.palette.primary.main,
  },
  goIcon: {
    position: 'absolute',
    right: -10,
  },
  inputLabel: {
    float: 'left',
  },
  sortIcon: {
    float: 'left',
    margin: '-5px 0 0 15px',
  },
  icon: {
    color: theme.palette.primary.main,
  },
});

const inlineStylesHeaders = {
  iconSort: {
    position: 'absolute',
    margin: '0 0 0 5px',
    padding: 0,
    top: '0px',
  },
  type: {
    float: 'left',
    width: '15%',
    fontSize: 12,
    fontWeight: '700',
  },
  default_value: {
    float: 'left',
    width: '40%',
    fontSize: 12,
    fontWeight: '700',
  },
  nb_dependencies: {
    float: 'left',
    width: '10%',
    fontSize: 12,
    fontWeight: '700',
  },
  nb_inbound_dependencies: {
    float: 'left',
    width: '10%',
    fontSize: 12,
    fontWeight: '700',
  },
  created: {
    float: 'left',
    fontSize: 12,
    fontWeight: '700',
  },
};

const inlineStyles = {
  type: {
    float: 'left',
    width: '15%',
    height: 20,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  default_value: {
    float: 'left',
    width: '40%',
    height: 20,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nb_dependencies: {
    float: 'left',
    width: '10%',
    height: 20,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nb_inbound_dependencies: {
    float: 'left',
    width: '10%',
    height: 20,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  created: {
    float: 'left',
    height: 20,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

const pendingFileContentUploadMutation = graphql`
  mutation PendingFileContentUploadMutation($file: Upload!, $entityId: String) {
    uploadPending(file: $file, entityId: $entityId) {
      ...FileLine_file
    }
  }
`;

const pendingFileContentDeleteMutation = graphql`
  mutation PendingFileContentDeleteMutation($fileName: String) {
    deleteImport(fileName: $fileName)
  }
`;

const importValidation = (t) => Yup.object().shape({
  connector_id: Yup.string().required(t('This field is required')),
});

class PendingFileContentComponent extends Component {
  constructor(props) {
    super(props);
    this.state = {
      allObjectsIds: [],
      checkedObjects: [],
      uncheckedObjects: [],
      objects: [],
      indexedObjects: {},
      objectsWithDependencies: [],
      indexedObjectsWithDependencies: {},
      dataToValidate: null,
      sortBy: 'nb_inbound_dependencies',
      orderAsc: false,
      checkAll: true,
      currentJson: '',
      displayJson: false,
    };
  }

  handleOpenValidate() {
    const indexedObjects = R.indexBy(R.prop('id'), this.state.objects);
    const data = R.map((n) => indexedObjects[n], this.state.checkedObjects);
    this.setState({ dataToValidate: data });
  }

  handleCloseValidate() {
    this.setState({ dataToValidate: null });
  }

  handleOpenJson(content) {
    this.setState({ displayJson: true, currentJson: content });
  }

  handleCloseJson() {
    this.setState({ displayJson: false, currentJson: '' });
  }

  onSubmitValidate(values, { setSubmitting, resetForm }) {
    const objects = this.state.dataToValidate;
    const data = { id: `bundle--${uuid()}`, type: 'bundle', objects };
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'text/json' });
    const file = new File([blob], this.props.file.name, {
      type: 'application/json',
    });
    commitMutation({
      mutation: pendingFileContentUploadMutation,
      variables: {
        file,
        entityId: this.props.file.metaData.entity
          ? this.props.file.metaData.entity.id
          : null,
      },
      onCompleted: () => {
        setTimeout(() => {
          commitMutation({
            mutation: fileManagerAskJobImportMutation,
            variables: {
              fileName: this.props.file.id,
              connectorId: values.connector_id,
              bypassValidation: true,
            },
            onCompleted: () => {
              setSubmitting(false);
              resetForm();
              this.handleCloseValidate();
              MESSAGING$.notifySuccess('Import successfully asked');
              if (this.props.file.metaData.entity) {
                const entityLink = `${resolveLink(
                  this.props.file.metaData.entity.entity_type,
                )}/${this.props.file.metaData.entity.id}`;
                this.props.history.push(`${entityLink}/files`);
              } else {
                this.props.history.push('/dashboard/import');
              }
            },
          });
        }, 2000);
      },
    });
  }

  handleDrop() {
    const { file } = this.props;
    commitMutation({
      mutation: pendingFileContentDeleteMutation,
      variables: { fileName: file.id },
      onCompleted: () => {
        if (this.props.file.metaData.entity) {
          const entityLink = `${resolveLink(
            this.props.file.metaData.entity.entity_type,
          )}/${this.props.file.metaData.entity.id}`;
          this.props.history.push(`${entityLink}/files`);
        } else {
          this.props.history.push('/dashboard/import');
        }
      },
    });
  }

  loadFileContent() {
    const { file } = this.props;
    const url = `/storage/view/${file.id}`;
    Axios.get(url).then((res) => {
      const state = this.computeState(res.data.objects);
      this.setState(state);
      return true;
    });
  }

  componentDidMount() {
    this.loadFileContent();
  }

  // eslint-disable-next-line class-methods-use-this
  computeState(objects) {
    const dependencies = {};
    for (const object of objects) {
      let objectDependencies = [];
      for (const [key, value] of Object.entries(object)) {
        if (key.endsWith('_refs')) {
          objectDependencies = [...objectDependencies, ...value];
        } else if (key.endsWith('_ref')) {
          const isCreatedByRef = key === 'created_by_ref';
          if (isCreatedByRef) {
            if (!object.id.startsWith('marking-definition--')) {
              objectDependencies = R.append(value, objectDependencies);
            }
          } else {
            objectDependencies = R.append(value, objectDependencies);
          }
        }
      }
      dependencies[object.id] = {
        id: object.id,
        dependencies: objectDependencies,
      };
    }
    let objectsWithDependencies = [];
    for (const object of objects) {
      const objectWithDependencies = R.assoc(
        'default_value',
        defaultValue(object),
        object,
      );
      objectWithDependencies.dependencies = dependencies[object.id].dependencies;
      objectWithDependencies.nb_dependencies = objectWithDependencies.dependencies.length;
      objectWithDependencies.inbound_dependencies = R.map(
        (n) => n.id,
        R.filter(
          (o) => o.dependencies.includes(object.id),
          R.values(dependencies),
        ),
      );
      // eslint-disable-next-line max-len
      objectWithDependencies.nb_inbound_dependencies = objectWithDependencies.inbound_dependencies.length;
      objectsWithDependencies = R.append(
        objectWithDependencies,
        objectsWithDependencies,
      );
    }
    const allObjectsIds = R.map((n) => n.id, objects);
    const indexedObjects = R.indexBy(R.prop('id'), objects);
    const indexedObjectsWithDependencies = R.indexBy(
      R.prop('id'),
      objectsWithDependencies,
    );
    return {
      allObjectsIds,
      checkedObjects: allObjectsIds,
      objects,
      indexedObjects,
      objectsWithDependencies,
      indexedObjectsWithDependencies,
    };
  }

  handleToggleItem(itemId) {
    let checkedObjects = [];
    let uncheckedObjects = [];
    const item = this.state.indexedObjectsWithDependencies[itemId];
    if (this.state.checkedObjects.includes(itemId)) {
      uncheckedObjects = R.append(itemId, this.state.uncheckedObjects);
      checkedObjects = R.filter(
        (n) => n !== itemId && !item.inbound_dependencies.includes(n),
        this.state.checkedObjects,
      );
    } else {
      uncheckedObjects = R.filter(
        (n) => n !== itemId,
        this.state.uncheckedObjects,
      );
      checkedObjects = R.append(itemId, this.state.checkedObjects);
      checkedObjects = [
        ...checkedObjects,
        ...R.filter(
          (n) => item.inbound_dependencies.includes(n)
            && !uncheckedObjects.includes(n),
          this.state.allObjectsIds,
        ),
      ];
    }
    this.setState({ checkedObjects, uncheckedObjects });
  }

  handleToggleAll() {
    if (this.state.checkAll) {
      this.setState({
        checkedObjects: [],
        uncheckedObjects: R.map((n) => n.id, this.state.objects),
        checkAll: false,
      });
    } else {
      this.setState({
        checkedObjects: R.map((n) => n.id, this.state.objects),
        uncheckedObjects: [],
        checkAll: true,
      });
    }
  }

  reverseBy(field) {
    this.setState({ sortBy: field, orderAsc: !this.state.orderAsc });
  }

  SortHeader(field, label, isSortable) {
    const { t } = this.props;
    const sortComponent = this.state.orderAsc ? (
      <ArrowDropDown style={inlineStylesHeaders.iconSort} />
    ) : (
      <ArrowDropUp style={inlineStylesHeaders.iconSort} />
    );
    if (isSortable) {
      return (
        <div
          style={inlineStylesHeaders[field]}
          onClick={this.reverseBy.bind(this, field)}
        >
          <span>{t(label)}</span>
          {this.state.sortBy === field ? sortComponent : ''}
        </div>
      );
    }
    return (
      <div style={inlineStylesHeaders[field]}>
        <span>{t(label)}</span>
      </div>
    );
  }

  render() {
    const {
      classes, t, file, fldt, connectorsImport, nsdt,
    } = this.props;
    const {
      objectsWithDependencies,
      objects,
      indexedObjects,
      checkedObjects,
      dataToValidate,
      checkAll,
      displayJson,
      currentJson,
    } = this.state;
    let entityLink = null;
    if (file.metaData.entity) {
      entityLink = `${resolveLink(file.metaData.entity.entity_type)}/${
        file.metaData.entity.id
      }`;
    }
    const sort = R.sortWith(
      this.state.orderAsc
        ? [R.ascend(R.prop(this.state.sortBy))]
        : [R.descend(R.prop(this.state.sortBy))],
    );
    const sortedObjectsWithDependencies = sort(objectsWithDependencies);
    const numberOfEntities = R.filter(
      (n) => n.entity_type !== 'relationship',
      objects,
    ).length;
    const numberOfRelationships = R.filter(
      (n) => n.entity_type === 'relationship',
      objects,
    ).length;
    return (
      <div className={classes.container}>
        <Typography
          variant="h1"
          gutterBottom={true}
          classes={{ root: classes.title }}
        >
          {t('Data import')}
        </Typography>
        <div className="clearfix" />
        <Grid
          container={true}
          spacing={3}
          classes={{ container: classes.gridContainer }}
        >
          <Grid item={true} xs={6}>
            <div style={{ height: '100%' }}>
              <Typography variant="h4" gutterBottom={true}>
                {t('File information')}
              </Typography>
              <Paper classes={{ root: classes.paper }} elevation={2}>
                <Grid container={true} spacing={3}>
                  <Grid item={true} xs={12}>
                    <Typography variant="h3" gutterBottom={true}>
                      {t('Name')}
                    </Typography>
                    <pre style={{ marginBottom: 0 }}>{file.name}</pre>
                  </Grid>
                  <Grid item={true} xs={6}>
                    <Typography variant="h3" gutterBottom={true}>
                      {t('Mime-Type')}
                    </Typography>
                    <pre>{file.metaData.mimetype}</pre>
                    <Typography
                      variant="h3"
                      gutterBottom={true}
                      style={{ marginTop: 20 }}
                    >
                      {t('Last modified')}
                    </Typography>
                    {fldt(file.lastModified)}
                  </Grid>
                  <Grid item={true} xs={6}>
                    <Typography variant="h3" gutterBottom={true}>
                      {t('Encoding')}
                    </Typography>
                    <pre>{file.metaData.encoding}</pre>
                    <Typography
                      variant="h3"
                      gutterBottom={true}
                      style={{ marginTop: 20 }}
                    >
                      {t('Linked entity')}
                    </Typography>
                    {file.metaData.entity ? (
                      <Button
                        variant="outlined"
                        color="secondary"
                        component={Link}
                        to={entityLink}
                        startIcon={
                          <ItemIcon type={file.metaData.entity.entity_type} />
                        }
                      >
                        {defaultValue(file.metaData.entity)}
                      </Button>
                    ) : (
                      t('None')
                    )}
                  </Grid>
                </Grid>
              </Paper>
            </div>
          </Grid>
          <Grid item={true} xs={6}>
            <div style={{ height: '100%' }}>
              <Typography variant="h4" gutterBottom={true}>
                {t('Bundle details')}
              </Typography>
              <Paper classes={{ root: classes.paper }} elevation={2}>
                <Grid container={true} spacing={3}>
                  <Grid item={true} xs={6}>
                    <Typography variant="h3" gutterBottom={true}>
                      {t('Number of entities')}
                    </Typography>
                    <span style={{ fontSize: 20 }}>{numberOfEntities}</span>
                  </Grid>
                  <Grid item={true} xs={6}>
                    <Typography variant="h3" gutterBottom={true}>
                      {t('Number of relationships')}
                    </Typography>
                    <span style={{ fontSize: 20 }}>
                      {numberOfRelationships}
                    </span>
                  </Grid>
                </Grid>
              </Paper>
            </div>
          </Grid>
        </Grid>
        <Typography variant="h4" gutterBottom={true} style={{ marginTop: 35 }}>
          {t('Bundle content')}
        </Typography>
        <Paper classes={{ root: classes.paperList }} elevation={2}>
          <List classes={{ root: classes.linesContainer }}>
            <ListItem
              classes={{ root: classes.itemHead }}
              divider={false}
              style={{ paddingTop: 0 }}
            >
              <ListItemIcon>
                <span
                  style={{
                    padding: '0 8px 0 8px',
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  #
                </span>
              </ListItemIcon>
              <ListItemText
                primary={
                  <div>
                    {this.SortHeader('type', 'Type', true)}
                    {this.SortHeader('default_value', 'Name', true)}
                    {this.SortHeader('nb_dependencies', 'Dependencies', true)}
                    {this.SortHeader(
                      'nb_inbound_dependencies',
                      'Impacted',
                      true,
                    )}
                    {this.SortHeader('created', 'Creation date', true)}
                  </div>
                }
              />
              <ListItemSecondaryAction>
                <Checkbox
                  edge="end"
                  onChange={this.handleToggleAll.bind(this)}
                  checked={checkAll}
                />
              </ListItemSecondaryAction>
            </ListItem>
            {sortedObjectsWithDependencies.map((object) => {
              const type = object.type === 'x-opencti-simple-observable'
                ? observableKeyToType(object.key)
                : convertStixType(object.type);
              return (
                <ListItem
                  key={object.id}
                  classes={{ root: classes.item }}
                  divider={true}
                  button={true}
                  onClick={this.handleOpenJson.bind(
                    this,
                    JSON.stringify(indexedObjects[object.id]),
                  )}
                >
                  <ListItemIcon color="primary">
                    <ItemIcon type={type} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <div>
                        <div
                          className={classes.bodyItem}
                          style={inlineStyles.type}
                        >
                          {type}
                        </div>
                        <div
                          className={classes.bodyItem}
                          style={inlineStyles.default_value}
                        >
                          {object.default_value}
                        </div>
                        <div
                          className={classes.bodyItem}
                          style={inlineStyles.nb_dependencies}
                        >
                          {object.nb_dependencies}
                        </div>
                        <div
                          className={classes.bodyItem}
                          style={inlineStyles.nb_inbound_dependencies}
                        >
                          {object.nb_inbound_dependencies}
                        </div>
                        <div
                          className={classes.bodyItem}
                          style={inlineStyles.created}
                        >
                          {nsdt(object.created)}
                        </div>
                      </div>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Checkbox
                      edge="end"
                      onChange={this.handleToggleItem.bind(this, object.id)}
                      checked={checkedObjects.includes(object.id)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        </Paper>
        <PendingFileToolBar
          handleValidate={this.handleOpenValidate.bind(this)}
          handleDrop={this.handleDrop.bind(this)}
          numberOfSelectedElements={checkedObjects.length}
          isDeleteActive={file.works.length > 0}
        />
        <Formik
          enableReinitialize={true}
          initialValues={{ connector_id: '' }}
          validationSchema={importValidation(t)}
          onSubmit={this.onSubmitValidate.bind(this)}
          onReset={this.handleCloseValidate.bind(this)}
        >
          {({ submitForm, handleReset, isSubmitting }) => (
            <Form style={{ margin: '0 0 20px 0' }}>
              <Dialog
                open={dataToValidate}
                keepMounted={true}
                onClose={this.handleCloseValidate.bind(this)}
                fullWidth={true}
              >
                <DialogTitle>{t('Validate and send for import')}</DialogTitle>
                <DialogContent>
                  <Field
                    component={SelectField}
                    name="connector_id"
                    label={t('Connector')}
                    fullWidth={true}
                    containerstyle={{ width: '100%' }}
                  >
                    {connectorsImport.map((connector, i) => {
                      const disabled = !dataToValidate
                        || (connector.connector_scope.length > 0
                          && !R.includes(
                            'application/json',
                            connector.connector_scope,
                          ));
                      return (
                        <MenuItem
                          key={i}
                          value={connector.id}
                          disabled={disabled || !connector.active}
                        >
                          {connector.name}
                        </MenuItem>
                      );
                    })}
                  </Field>
                </DialogContent>
                <DialogActions>
                  <Button
                    onClick={handleReset}
                    disabled={isSubmitting}
                    classes={{ root: classes.button }}
                  >
                    {t('Cancel')}
                  </Button>
                  <Button
                    color="primary"
                    onClick={submitForm}
                    disabled={isSubmitting}
                    classes={{ root: classes.button }}
                  >
                    {t('Create')}
                  </Button>
                </DialogActions>
              </Dialog>
            </Form>
          )}
        </Formik>
        <Dialog
          open={displayJson}
          keepMounted={true}
          onClick={this.handleCloseJson.bind(this)}
          fullWidth={true}
        >
          <DialogTitle>{t('JSON content')}</DialogTitle>
          <DialogContent>
            <pre>{currentJson}</pre>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={this.handleCloseJson.bind(this)}
              classes={{ root: classes.button }}
            >
              {t('Close')}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    );
  }
}

PendingFileContentComponent.propTypes = {
  file: PropTypes.object,
  connectorsImport: PropTypes.array,
  children: PropTypes.node,
  match: PropTypes.object,
  me: PropTypes.object,
  t: PropTypes.func,
  fldt: PropTypes.func,
};

const PendingFileContent = createFragmentContainer(
  PendingFileContentComponent,
  {
    connectorsImport: graphql`
      fragment PendingFileContent_connectorsImport on Connector
      @relay(plural: true) {
        id
        name
        active
        only_contextual
        connector_scope
        updated_at
      }
    `,
    file: graphql`
      fragment PendingFileContent_file on File {
        id
        name
        uploadStatus
        lastModified
        lastModifiedSinceMin
        metaData {
          mimetype
          encoding
          list_filters
          messages {
            timestamp
            message
          }
          errors {
            timestamp
            message
          }
          entity_id
          entity {
            id
            entity_type
            ... on AttackPattern {
              name
            }
            ... on Campaign {
              name
            }
            ... on Report {
              name
            }
            ... on CourseOfAction {
              name
            }
            ... on Individual {
              name
            }
            ... on Organization {
              name
            }
            ... on Sector {
              name
            }
            ... on System {
              name
            }
            ... on Indicator {
              name
            }
            ... on Infrastructure {
              name
            }
            ... on IntrusionSet {
              name
            }
            ... on Position {
              name
            }
            ... on City {
              name
            }
            ... on Country {
              name
            }
            ... on Region {
              name
            }
            ... on Malware {
              name
            }
            ... on ThreatActor {
              name
            }
            ... on Tool {
              name
            }
            ... on Vulnerability {
              name
            }
            ... on Incident {
              name
            }
            ... on StixCyberObservable {
              observable_value
            }
          }
        }
        works {
          id
        }
        ...FileWork_file
      }
    `,
  },
);

export default R.compose(
  inject18n,
  withRouter,
  withStyles(styles),
)(PendingFileContent);